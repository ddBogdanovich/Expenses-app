namespace PocketLedger.UseCases.Authentication.Preview;

/// <summary>Names the temporary, explicitly selected browser authentication boundary.</summary>
public static class PreviewAuthentication
{
    public const string CookieScheme = "PreviewCookie";
    public const string OidcScheme = "PreviewOidc";
    public const string SelectorScheme = "AccountAuthentication";
    public const string SelectorHeader = "X-PocketLedger-Auth";
    public const string SelectorValue = "preview";
    public const string LocalAccountClaim = "pocketledger:account-id";
    public const string AbsoluteExpiryProperty = "pocketledger:absolute-expiry";
    public const string CallbackPath = "/api/auth/preview/callback";
    public const string SignedOutPath = "/api/auth/preview/signed-out";
    public const string LandingPath = "/preview";
}

public interface IPreviewAvailability
{
    bool Enabled { get; }
}
