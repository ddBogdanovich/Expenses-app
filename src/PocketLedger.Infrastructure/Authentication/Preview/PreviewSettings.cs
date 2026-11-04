using PocketLedger.UseCases.Authentication.Preview;

namespace PocketLedger.Infrastructure.Authentication.Preview;

internal sealed class PreviewSettings : IPreviewAvailability
{
    public bool Enabled { get; set; }

    public string Authority { get; set; } = string.Empty;

    public string ClientId { get; set; } = "pocketledger-web";

    public string ClientSecret { get; set; } = string.Empty;

    public string BrowserOrigin { get; set; } = string.Empty;

    public static TimeSpan IdleLifetime => TimeSpan.FromMinutes(30);

    public static TimeSpan AbsoluteLifetime => TimeSpan.FromHours(8);

    public static TimeSpan TransactionLifetime => TimeSpan.FromMinutes(10);

    public static TimeSpan BackchannelTimeout => TimeSpan.FromSeconds(15);
}
