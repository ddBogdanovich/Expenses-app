using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.Domain.Accounts;
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

}
