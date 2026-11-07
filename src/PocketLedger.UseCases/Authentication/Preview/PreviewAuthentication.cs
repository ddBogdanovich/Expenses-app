namespace PocketLedger.UseCases.Authentication.Preview;

/// <summary>Names the sole browser authentication boundary; preview names preserve existing sessions and callbacks.</summary>
public static class PreviewAuthentication
{
    public const string CookieScheme = "PreviewCookie";
    public const string OidcScheme = "PreviewOidc";
    public const string LocalAccountClaim = "pocketledger:account-id";
    public const string AbsoluteExpiryProperty = "pocketledger:absolute-expiry";
    public const string CallbackPath = "/api/auth/preview/callback";
    public const string SignedOutPath = "/api/auth/preview/signed-out";
    public const string RegistrationProperty = "pocketledger.registration";
    public const string LandingPath = "/preview";
}

public interface IPreviewAvailability
{
    bool Enabled { get; }
}
