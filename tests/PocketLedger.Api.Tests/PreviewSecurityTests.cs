using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using PocketLedger.UseCases.Authentication.Preview;

namespace PocketLedger.Api.Tests;

/// <summary>Exercises the real cookie, ticket database, and protocol middleware without provider credentials.</summary>
public sealed class PreviewSecurityTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    [Theory]
    [InlineData("/api/auth/me")]
    [InlineData("/api/expenses/today")]
    [InlineData("/api/auth/preview/antiforgery")]
    public async Task UnauthorizedResponsesAreNeverCachedOrRedirectedAsync(string route)
    {
        using var application = CreateApplication(new SessionClock());
        using var client = CreateClient(application);
        client.DefaultRequestHeaders.Add(PreviewAuthentication.SelectorHeader, PreviewAuthentication.SelectorValue);
        using var response = await client.GetAsync(new Uri(route, UriKind.Relative));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    [Fact]
    public async Task RestoredSessionSlidesButNeverOutlivesAbsoluteExpiryAsync()
    {
        var clock = new SessionClock();
        using var application = CreateApplication(clock);
        using var client = CreateClient(application);
        using var signIn = await client.GetAsync(new Uri("/test/session", UriKind.Relative));
        Assert.Contains("httponly", string.Join(";", signIn.Headers.GetValues("Set-Cookie")), StringComparison.OrdinalIgnoreCase);
        client.DefaultRequestHeaders.Add(PreviewAuthentication.SelectorHeader, PreviewAuthentication.SelectorValue);
        for (var request = 0; request < 23; request++)
        {
            clock.Advance(TimeSpan.FromMinutes(20));
            using var restored = await client.GetAsync(new Uri("/api/auth/me", UriKind.Relative));
            Assert.Equal(HttpStatusCode.OK, restored.StatusCode);
            Assert.True(restored.Headers.CacheControl?.NoStore);
        }

        clock.Advance(TimeSpan.FromMinutes(20));
        using var expired = await client.GetAsync(new Uri("/api/auth/me", UriKind.Relative));
        Assert.Equal(HttpStatusCode.Unauthorized, expired.StatusCode);
        Assert.Null(expired.Headers.Location);
    }

    [Fact]
    public async Task IdleSessionExpiresAndCannotBeRenewedAsync()
    {
        var clock = new SessionClock();
        using var application = CreateApplication(clock);
        using var client = CreateClient(application);
        using var signIn = await client.GetAsync(new Uri("/test/session", UriKind.Relative));
        clock.Advance(TimeSpan.FromMinutes(30));
        client.DefaultRequestHeaders.Add(PreviewAuthentication.SelectorHeader, PreviewAuthentication.SelectorValue);
        using var expired = await client.GetAsync(new Uri("/api/auth/me", UriKind.Relative));
        Assert.Equal(HttpStatusCode.Unauthorized, expired.StatusCode);
    }

    [Theory]
    [InlineData("//evil.example")]
    [InlineData("https://evil.example")]
    [InlineData("/api/auth/preview/start")]
    [InlineData("/preview?returnUrl=https://evil.example")]
    public async Task UnapprovedReturnDestinationsAreRejectedAsync(string destination)
    {
        using var application = CreateApplication(new SessionClock());
        using var client = CreateClient(application);
        using var response = await client.GetAsync(new Uri("/api/auth/preview/start?returnUrl=" + Uri.EscapeDataString(destination), UriKind.Relative));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    [Theory]
    [InlineData("/preview")]
    [InlineData("/")]
    [InlineData("/design-system")]
    public async Task ApprovedReturnUsesCodeFlowWithPkceAsync(string destination)
    {
        using var application = CreateApplication(new SessionClock());
        using var client = CreateClient(application);
        using var response = await client.GetAsync(new Uri("/api/auth/preview/start?returnUrl=" + Uri.EscapeDataString(destination), UriKind.Relative));
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location!.OriginalString;
        Assert.StartsWith("https://identity.example/authorize?", location, StringComparison.Ordinal);
        Assert.Contains("code_challenge_method=S256", location, StringComparison.Ordinal);
        Assert.Contains("response_type=code", location, StringComparison.Ordinal);
        Assert.DoesNotContain("client_secret", location, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("?code=sensitive-code&state=sensitive-state")]
    [InlineData("?error=access_denied&error_description=sensitive-description&state=invalid")]
    [InlineData("")]
    public async Task InvalidCallbacksHaveBoundedSecretFreeResponsesAsync(string query)
    {
        using var logs = new CapturedLogs();
        using var application = CreateApplication(new SessionClock(), logs: logs);
        using var client = CreateClient(application);
        using var response = await client.GetAsync(new Uri(PreviewAuthentication.CallbackPath + query, UriKind.Relative));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(response.Headers.Location);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("auth.callback_failed", body.GetProperty("code").GetString());
        Assert.DoesNotContain("sensitive-", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.DoesNotContain("sensitive-", string.Join('\n', logs.Messages), StringComparison.Ordinal);
    }

    [Fact]
    public async Task ProviderOutageReturnsServiceUnavailableWithoutALoopAsync()
    {
        using var application = CreateApplication(new SessionClock(), unavailable: true);
        using var client = CreateClient(application);
        using var response = await client.GetAsync(new Uri("/api/auth/preview/start", UriKind.Relative));
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Null(response.Headers.Location);
        Assert.True(response.Headers.CacheControl?.NoStore);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("auth.provider_unavailable", body.GetProperty("code").GetString());
    }

    private WebApplicationFactory<Program> CreateApplication(SessionClock clock, bool unavailable = false, CapturedLogs? logs = null) =>
        database.CreateApplication(builder =>
        {
            builder.UseSetting("Keycloak:Enabled", "true");
            builder.UseSetting("Keycloak:Authority", "https://identity.example");
            builder.UseSetting("Keycloak:BrowserOrigin", "https://localhost");
            builder.UseSetting("Keycloak:ClientSecret", "test-client-secret");
            if (logs is not null)
            {
                builder.ConfigureLogging(logging => logging.AddProvider(logs));
            }

            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<TimeProvider>();
                services.AddSingleton<TimeProvider>(clock);
                services.AddSingleton<IStartupFilter>(new SessionEndpoint(clock));
                services.PostConfigure<CookieAuthenticationOptions>(PreviewAuthentication.CookieScheme, options => options.TimeProvider = clock);
                services.PostConfigure<OpenIdConnectOptions>(PreviewAuthentication.OidcScheme, options =>
                {
                    options.TimeProvider = clock;
                    if (unavailable)
                    {
                        options.ConfigurationManager = new UnavailableConfiguration();
                    }
                    else
                    {
                        options.ConfigurationManager = new Microsoft.IdentityModel.Protocols.StaticConfigurationManager<OpenIdConnectConfiguration>(new OpenIdConnectConfiguration
                        {
                            Issuer = "https://identity.example",
                            AuthorizationEndpoint = "https://identity.example/authorize",
                            TokenEndpoint = "https://identity.example/token",
                            EndSessionEndpoint = "https://identity.example/logout"
                        });
                    }
                });
            });
        });

    private static HttpClient CreateClient(WebApplicationFactory<Program> application) => application.CreateClient(new WebApplicationFactoryClientOptions
    {
        AllowAutoRedirect = false,
        BaseAddress = new Uri("https://localhost")
    });

    private sealed class SessionClock : TimeProvider
    {
        private DateTimeOffset _now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan elapsed) => _now += elapsed;
    }

    private sealed class SessionEndpoint(SessionClock clock) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use(async (context, continuation) =>
            {
                if (context.Request.Path == "/test/session")
                {
                    var now = clock.GetUtcNow();
                    var properties = new AuthenticationProperties { IsPersistent = true, IssuedUtc = now, ExpiresUtc = now.AddMinutes(30) };
                    properties.Items[PreviewAuthentication.AbsoluteExpiryProperty] = now.AddHours(8).ToString("O", CultureInfo.InvariantCulture);
                    await context.SignInAsync(PreviewAuthentication.CookieScheme, new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(PreviewAuthentication.LocalAccountClaim, Guid.NewGuid().ToString())], PreviewAuthentication.CookieScheme)), properties).ConfigureAwait(false);
                    return;
                }

                await continuation(context).ConfigureAwait(false);
            });
            next(app);
        };
    }

    private sealed class UnavailableConfiguration : Microsoft.IdentityModel.Protocols.IConfigurationManager<OpenIdConnectConfiguration>
    {
        public Task<OpenIdConnectConfiguration> GetConfigurationAsync(CancellationToken cancel) =>
            Task.FromException<OpenIdConnectConfiguration>(new InvalidOperationException("Metadata unavailable.", new IOException("Provider unavailable.")));
        public void RequestRefresh() { }
    }

    private sealed class CapturedLogs : ILoggerProvider
    {
        internal System.Collections.Concurrent.ConcurrentQueue<string> Messages { get; } = new();
        public ILogger CreateLogger(string categoryName) => new CapturedLogger(Messages);
        public void Dispose() { }
        private sealed class CapturedLogger(System.Collections.Concurrent.ConcurrentQueue<string> messages) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) => messages.Enqueue(formatter(state, exception) + exception);
        }
    }
}
