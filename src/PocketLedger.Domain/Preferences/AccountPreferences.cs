namespace PocketLedger.Domain.Preferences;

/// <summary>Financial defaults belonging to one stable local account, independent of credentials.</summary>
public sealed class AccountPreferences
{
    public const string InitialTimeZone = "Europe/Warsaw";
    public const string InitialCurrency = "PLN";
    public const int MaximumTimeZoneLength = 100;

    private AccountPreferences(Guid ownerId)
    {
        OwnerId = ownerId;
    }

    public Guid OwnerId { get; private set; }
    public string TimeZone { get; private set; } = InitialTimeZone;
    public string DefaultCurrency { get; private set; } = InitialCurrency;
    public IReadOnlyList<string> RecentCurrencies { get; private set; } = Array.Empty<string>();
    public long Revision { get; private set; }

    /// <summary>Creates the initial defaults without requiring onboarding.</summary>
    public static AccountPreferences Create(Guid ownerId) => ownerId != Guid.Empty
        ? new(ownerId)
        : throw new ArgumentException("An owner is required.", nameof(ownerId));

    /// <summary>Changes a boundary-validated regional zone without changing currency intent.</summary>
    public void ChangeTimeZone(string timeZone)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(timeZone);
        if (timeZone.Length > MaximumTimeZoneLength)
        {
            throw new ArgumentOutOfRangeException(nameof(timeZone));
        }

        TimeZone = timeZone;
        Revision = checked(Revision + 1);
    }
}
