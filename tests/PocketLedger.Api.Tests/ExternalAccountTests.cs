using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.Domain.Accounts;
using PocketLedger.Infrastructure.Persistence;
using PocketLedger.UseCases.Authentication.Common;
using PocketLedger.UseCases.Authentication.ResolveExternalAccount;

namespace PocketLedger.Api.Tests;

public sealed class ExternalAccountTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    [Fact]
    public async Task RepeatedOpaqueIdentityResolvesToSameLocalAccountAfterApiRestartAsync()
    {
        const string issuer = "https://identity.example/realms/ledger";
        var subject = "opaque-" + Guid.NewGuid();
        var request = new ResolveExternalAccountRequest(issuer, subject, "owner@example.com");
        Guid first;
        using (var application = database.CreateApplication())
        using (var scope = application.Services.CreateScope())
        {
            var result = await scope.ServiceProvider.GetRequiredService<ResolveExternalAccountHandler>().HandleAsync(request, CancellationToken.None);
            Assert.True(result.IsSuccess);
            first = result.Value;
        }

        using var restarted = database.CreateApplication();
        using var restartedScope = restarted.Services.CreateScope();
        var repeated = await restartedScope.ServiceProvider.GetRequiredService<ResolveExternalAccountHandler>()
            .HandleAsync(request with { Email = "changed@example.com" }, CancellationToken.None);
        Assert.Equal(first, repeated.Value);
    }

    [Fact]
    public async Task ReusingLegacyEmailDoesNotLinkOwnershipOrAuthenticateExternalRowWithPasswordAsync()
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        var email = $"shared-{Guid.NewGuid():N}@example.com";
        var credentials = new CredentialsRequest(email, "A sufficiently long test password");
        var registration = await client.PostAsJsonAsync("/api/auth/register", credentials);
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        var legacyToken = await registration.Content.ReadFromJsonAsync<TokenResponse>();
        using var scope = application.Services.CreateScope();
        var external = await scope.ServiceProvider.GetRequiredService<ResolveExternalAccountHandler>()
            .HandleAsync(new ResolveExternalAccountRequest("https://identity.example", Guid.NewGuid().ToString(), email), CancellationToken.None);
        Assert.True(external.IsSuccess);
        var repository = scope.ServiceProvider.GetRequiredService<IUserAccountRepository>();
        Assert.True(EmailAddress.TryCreate(email, out var address));
        var legacy = await repository.FindByEmailAsync(address, CancellationToken.None);
        Assert.NotNull(legacy);
        Assert.NotEqual(legacy.Id, external.Value);
        Assert.Null(legacy.ExternalIdentity);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login", credentials)).StatusCode);
        using var preview = new HttpRequestMessage(HttpMethod.Get, "/api/expenses/today");
        preview.Headers.Add("X-PocketLedger-Auth", "preview");
        preview.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", legacyToken!.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(preview)).StatusCode);
    }

    [Fact]
    public async Task ConcurrentFirstRequestsResolveExactlyOneOpaqueIdentityAsync()
    {
        using var application = database.CreateApplication();
        // Initialize migrations before opening independent concurrent request scopes.
        _ = application.Services;
        var request = new ResolveExternalAccountRequest("https://identity.example/realms/race", "opaque/" + Guid.NewGuid(), "race@example.com");
        var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var attempts = Enumerable.Range(0, 16).Select(async _ =>
        {
            using var scope = application.Services.CreateScope();
            await start.Task.ConfigureAwait(true);
            return await scope.ServiceProvider.GetRequiredService<ResolveExternalAccountHandler>().HandleAsync(request, CancellationToken.None).ConfigureAwait(true);
        }).ToArray();
        start.SetResult();
        var results = await Task.WhenAll(attempts);
        Assert.All(results, result => Assert.True(result.IsSuccess));
        var accountId = Assert.Single(results.Select(result => result.Value).Distinct());
        using var verification = application.Services.CreateScope();
        var accounts = verification.ServiceProvider.GetRequiredService<ExpensesDbContext>().Set<UserAccount>();
        Assert.Equal(1, await accounts.CountAsync(account => account.ExternalIdentity != null &&
            account.ExternalIdentity.Issuer == request.Issuer && account.ExternalIdentity.Subject == request.Subject));
        var repeated = await verification.ServiceProvider.GetRequiredService<ResolveExternalAccountHandler>()
            .HandleAsync(request with { Email = null }, CancellationToken.None);
        Assert.Equal(accountId, repeated.Value);
    }

    [Fact]
    public async Task IssuerAndCaseSensitiveSubjectDefineOwnershipIndependentlyOfEmailAsync()
    {
        using var application = database.CreateApplication();
        using var scope = application.Services.CreateScope();
        var handler = scope.ServiceProvider.GetRequiredService<ResolveExternalAccountHandler>();
        var subject = "Opaque/" + Guid.NewGuid();
        var first = await handler.HandleAsync(new("https://identity.example/realms/one", subject, "shared@example.com"), CancellationToken.None);
        var differentIssuer = await handler.HandleAsync(new("https://identity.example/realms/two", subject, "shared@example.com"), CancellationToken.None);
        var differentCase = await handler.HandleAsync(new("https://identity.example/realms/one", subject.ToUpperInvariant(), "shared@example.com"), CancellationToken.None);
        Assert.True(first.IsSuccess);
        Assert.True(differentIssuer.IsSuccess);
        Assert.True(differentCase.IsSuccess);
        Assert.Equal(3, new[] { first.Value, differentIssuer.Value, differentCase.Value }.Distinct().Count());
    }

    [Fact]
    public async Task LosingUniqueIdentityInsertCanReadWinnerAndContinueUsingItsScopeAsync()
    {
        using var application = database.CreateApplication();
        using var first = application.Services.CreateScope();
        using var second = application.Services.CreateScope();
        var identity = ExternalIdentity.Create("https://identity.example/race", "not-a-guid/" + Guid.NewGuid());
        Assert.True(EmailAddress.TryCreate("same@example.com", out var email));
        var repositories = new[] { first, second }.Select(scope => scope.ServiceProvider.GetRequiredService<IUserAccountRepository>()).ToArray();
        var candidates = new[] { UserAccount.Provision(email, identity), UserAccount.Provision(email, identity) };
        var inserted = await Task.WhenAll(repositories.Select((repository, index) => repository.TryAddAsync(candidates[index], CancellationToken.None)));
        Assert.Single(inserted, value => value);
        var winner = candidates[Array.IndexOf(inserted, true)].Id;
        var losingRepository = repositories[Array.IndexOf(inserted, false)];
        Assert.Equal(winner, (await losingRepository.FindByExternalIdentityAsync(identity, CancellationToken.None))!.Id);
        Assert.True(await losingRepository.TryAddAsync(UserAccount.Provision(email,
            ExternalIdentity.Create(identity.Issuer, "independent/" + Guid.NewGuid())), CancellationToken.None));
    }

}
