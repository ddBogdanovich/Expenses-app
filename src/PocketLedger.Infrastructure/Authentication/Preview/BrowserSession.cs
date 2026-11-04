namespace PocketLedger.Infrastructure.Authentication.Preview;

/// <summary>Infrastructure-only protected authentication ticket, never provider credentials.</summary>
internal sealed class BrowserSession
{
    public required string Id { get; init; }

    public required byte[] ProtectedTicket { get; set; }

    public DateTimeOffset ExpiresUtc { get; set; }
}
