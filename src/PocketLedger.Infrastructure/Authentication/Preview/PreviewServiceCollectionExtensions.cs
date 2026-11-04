using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using PocketLedger.UseCases.Authentication.Preview;
using PocketLedger.UseCases.Authentication.ResolveExternalAccount;

namespace PocketLedger.Infrastructure.Authentication.Preview;

public static class PreviewServiceCollectionExtensions
{
    private const string CookieName = "PocketLedger.Preview";
    private const string AntiforgeryHeader = "X-CSRF-TOKEN";

    public static IServiceCollection AddKeycloakPreview(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(environment);
        var settings = new PreviewSettings();
        configuration.GetSection("Keycloak").Bind(settings);
        var localEnvironment = environment.IsDevelopment() || environment.IsEnvironment("Testing");
        if (settings.Enabled && (!localEnvironment || !ValidAddress(settings.Authority) || !ValidAddress(settings.BrowserOrigin) ||
            !Uri.TryCreate(settings.BrowserOrigin, UriKind.Absolute, out var origin) || origin.AbsolutePath != "/" ||
            string.IsNullOrWhiteSpace(settings.ClientSecret) || string.IsNullOrWhiteSpace(settings.ClientId)))
        {
            throw new InvalidOperationException("Keycloak preview requires valid local-environment authority, browser origin, and confidential client configuration.");
        }

        services.AddSingleton<IPreviewAvailability>(settings);
        var protection = services.AddDataProtection().SetApplicationName("PocketLedger.Preview");
        var keyRingPath = configuration["Keycloak:KeyRingPath"];
        if (settings.Enabled && !string.IsNullOrWhiteSpace(keyRingPath))
        {
            protection.PersistKeysToFileSystem(new DirectoryInfo(keyRingPath));
        }

        services.AddAntiforgery(options => options.HeaderName = AntiforgeryHeader);
        services.AddScoped<PreviewAntiforgeryFilter>(provider => new PreviewAntiforgeryFilter(provider.GetRequiredService<Microsoft.AspNetCore.Antiforgery.IAntiforgery>()));
        services.AddControllers(options => options.Filters.AddService<PreviewAntiforgeryFilter>());
        services.AddSingleton<ITicketStore>(provider => new PostgresTicketStore(provider.GetRequiredService<IServiceScopeFactory>(), provider.GetRequiredService<IDataProtectionProvider>(), provider.GetRequiredService<TimeProvider>()));
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = PreviewAuthentication.SelectorScheme;
            options.DefaultChallengeScheme = PreviewAuthentication.SelectorScheme;
        }).AddPolicyScheme(PreviewAuthentication.SelectorScheme, null, options =>
        {
            options.ForwardDefaultSelector = context => context.Request.Headers[PreviewAuthentication.SelectorHeader].ToString() switch
            {
                "" => JwtBearerDefaults.AuthenticationScheme,
                PreviewAuthentication.SelectorValue when settings.Enabled => PreviewAuthentication.CookieScheme,
                _ => UnsupportedAuthenticationHandler.SchemeName
            };
        }).AddScheme<AuthenticationSchemeOptions, UnsupportedAuthenticationHandler>(UnsupportedAuthenticationHandler.SchemeName, null)
        .AddCookie(PreviewAuthentication.CookieScheme, options =>
        {
            options.Cookie.Name = CookieName;
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = localEnvironment ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
            options.ExpireTimeSpan = PreviewSettings.IdleLifetime;
            options.SlidingExpiration = true;
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToAccessDenied = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            };
            options.Events.OnValidatePrincipal = async context =>
            {
                var clock = context.HttpContext.RequestServices.GetRequiredService<TimeProvider>();
                if (!settings.Enabled || !context.Properties.Items.TryGetValue(PreviewAuthentication.AbsoluteExpiryProperty, out var value) ||
                    !DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var absolute) || absolute <= clock.GetUtcNow())
                {
                    context.RejectPrincipal();
                    await context.HttpContext.SignOutAsync(PreviewAuthentication.CookieScheme).ConfigureAwait(false);
                }
            };
        });
        services.AddTransient<UnsupportedAuthenticationHandler>(provider => new UnsupportedAuthenticationHandler(
            provider.GetRequiredService<Microsoft.Extensions.Options.IOptionsMonitor<AuthenticationSchemeOptions>>(),
            provider.GetRequiredService<Microsoft.Extensions.Logging.ILoggerFactory>(), System.Text.Encodings.Web.UrlEncoder.Default));
        services.AddOptions<CookieAuthenticationOptions>(PreviewAuthentication.CookieScheme)
            .Configure<ITicketStore>((options, store) => options.SessionStore = store);
        if (settings.Enabled)
        {
            AddOidc(services, settings, localEnvironment);
        }

        return services;
    }

    private static bool ValidAddress(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback) &&
        string.IsNullOrEmpty(uri.UserInfo) && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment);

    private static void AddOidc(IServiceCollection services, PreviewSettings settings, bool localEnvironment)
    {
        services.AddAuthentication().AddOpenIdConnect(PreviewAuthentication.OidcScheme, options =>
        {
            options.Authority = settings.Authority;
            options.ClientId = settings.ClientId;
            options.ClientSecret = settings.ClientSecret;
            options.SignInScheme = PreviewAuthentication.CookieScheme;
            options.SignOutScheme = PreviewAuthentication.CookieScheme;
            options.ResponseType = OpenIdConnectResponseType.Code;
            options.ResponseMode = OpenIdConnectResponseMode.Query;
            options.UsePkce = true;
            options.MapInboundClaims = false;
            options.SaveTokens = false;
            options.UseTokenLifetime = false;
            options.RequireHttpsMetadata = !localEnvironment;
            options.BackchannelTimeout = PreviewSettings.BackchannelTimeout;
            options.RemoteAuthenticationTimeout = PreviewSettings.TransactionLifetime;
            options.CallbackPath = PreviewAuthentication.CallbackPath;
            options.SignedOutCallbackPath = PreviewAuthentication.SignedOutPath;
            options.RemoteSignOutPath = PathString.Empty;
            options.Scope.Clear();
            options.Scope.Add("openid");
            options.Scope.Add("email");
            options.Scope.Add("profile");
            options.TokenValidationParameters.ValidIssuer = settings.Authority;
            options.TokenValidationParameters.ValidateIssuer = true;
            options.TokenValidationParameters.ValidAudience = settings.ClientId;
            options.TokenValidationParameters.ValidateAudience = true;
            options.TokenValidationParameters.ClockSkew = TimeSpan.Zero;
            options.CorrelationCookie.SameSite = SameSiteMode.Lax;
            options.NonceCookie.SameSite = SameSiteMode.Lax;
            options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.NonceCookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.Events.OnRedirectToIdentityProvider = context =>
            {
                context.ProtocolMessage.RedirectUri = settings.BrowserOrigin + PreviewAuthentication.CallbackPath;
                return Task.CompletedTask;
            };
            options.Events.OnAuthorizationCodeReceived = context =>
            {
                if (context.TokenEndpointRequest is not null)
                {
                    context.TokenEndpointRequest.RedirectUri = settings.BrowserOrigin + PreviewAuthentication.CallbackPath;
                }

                return Task.CompletedTask;
            };
            options.Events.OnTokenValidated = async context =>
            {
                var subject = context.Principal?.FindFirstValue("sub");
                if (string.IsNullOrWhiteSpace(subject) || context.SecurityToken.Issuer != settings.Authority)
                {
                    context.Fail("The provider identity is invalid.");
                    return;
                }

                var handler = context.HttpContext.RequestServices.GetRequiredService<ResolveExternalAccountHandler>();
                var result = await handler.HandleAsync(new ResolveExternalAccountRequest(settings.Authority, subject,
                    context.Principal?.FindFirstValue("email")), context.HttpContext.RequestAborted).ConfigureAwait(false);
                if (result.IsFailure)
                {
                    context.Fail("The provider account could not be resolved.");
                    return;
                }

                // Construct a local identity; provider claims cannot supply or override the account ID.
                context.Principal = new ClaimsPrincipal(new ClaimsIdentity(
                    [new Claim(PreviewAuthentication.LocalAccountClaim, result.Value.ToString()), new Claim("sub", subject), new Claim("iss", settings.Authority)],
                    PreviewAuthentication.CookieScheme));
            };
            options.Events.OnTicketReceived = context =>
            {
                var now = context.HttpContext.RequestServices.GetRequiredService<TimeProvider>().GetUtcNow();
                context.Properties ??= new AuthenticationProperties();
                context.Properties.IsPersistent = true;
                context.Properties.IssuedUtc = now;
                context.Properties.ExpiresUtc = now + PreviewSettings.IdleLifetime;
                context.Properties.Items[PreviewAuthentication.AbsoluteExpiryProperty] = (now + PreviewSettings.AbsoluteLifetime).ToString("O", CultureInfo.InvariantCulture);
                return Task.CompletedTask;
            };
            options.Events.OnRedirectToIdentityProviderForSignOut = context =>
            {
                context.ProtocolMessage.ClientId = settings.ClientId;
                context.ProtocolMessage.IdTokenHint = null;
                context.ProtocolMessage.PostLogoutRedirectUri = settings.BrowserOrigin + PreviewAuthentication.SignedOutPath;
                return Task.CompletedTask;
            };
            options.Events.OnRemoteFailure = context =>
            {
                context.HandleResponse();
                context.Response.Redirect(PreviewAuthentication.LandingPath + "?error=authentication_failed");
                return Task.CompletedTask;
            };
        });
    }
}
