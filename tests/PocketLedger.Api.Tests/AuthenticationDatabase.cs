using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.UseCases.Authentication.Preview;
using PocketLedger.UseCases.Authentication.ResolveExternalAccount;
using Testcontainers.PostgreSql;

namespace PocketLedger.Api.Tests;

/// <summary>Owns an isolated real PostgreSQL database for HTTP authentication scenarios.</summary>
[SuppressMessage("Maintainability", "CA1515:Consider making public types internal", Justification = "xUnit v2 constructs this public class fixture through its public test-class constructor.")]
public sealed class AuthenticationDatabase : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .Build();

    internal string ConnectionString => _postgres.GetConnectionString();

    internal string SigningKey { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

    public Task InitializeAsync() => _postgres.StartAsync();

    public Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

    internal WebApplicationFactory<Program> CreateApplication(Action<IWebHostBuilder>? configure = null) => new AuthenticationApplication(_postgres.GetConnectionString(), configure);

    // This endpoint exists only inside the HTTP test host. Real provider code flows are covered by E2E.
    private sealed class ExpenseSessionEndpoint : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use(async (context, continuation) =>
            {
                if (context.Request.Path == "/test/expense-session")
                {
                    var account = await context.RequestServices.GetRequiredService<ResolveExternalAccountHandler>()
                        .HandleAsync(new("https://identity.example", Guid.NewGuid().ToString(), "expense@example.com"), context.RequestAborted).ConfigureAwait(false);
                    var now = DateTimeOffset.UtcNow;
                    var properties = new AuthenticationProperties { IsPersistent = true, IssuedUtc = now, ExpiresUtc = now.AddMinutes(30) };
                    properties.Items[PreviewAuthentication.AbsoluteExpiryProperty] = now.AddHours(8).ToString("O", CultureInfo.InvariantCulture);
                    await context.SignInAsync(PreviewAuthentication.CookieScheme, new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(PreviewAuthentication.LocalAccountClaim, account.Value.ToString())], PreviewAuthentication.CookieScheme)), properties).ConfigureAwait(false);
                    return;
                }

                await continuation(context).ConfigureAwait(false);
            });
            next(app);
        };
    }

    private sealed class AuthenticationApplication(string connectionString, Action<IWebHostBuilder>? configure) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            ArgumentNullException.ThrowIfNull(builder);
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:expenses", connectionString);
            builder.UseSetting("Keycloak:Enabled", "true");
            builder.UseSetting("Keycloak:Authority", "https://identity.example");
            builder.UseSetting("Keycloak:BrowserOrigin", "http://localhost");
            builder.UseSetting("Keycloak:ClientSecret", "disposable-test-client-secret");
            builder.ConfigureServices(services => services.AddSingleton<IStartupFilter>(new ExpenseSessionEndpoint()));
            configure?.Invoke(builder);
        }
    }
}
