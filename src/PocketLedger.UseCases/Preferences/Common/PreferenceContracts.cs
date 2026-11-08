using System.Globalization;
using PocketLedger.Domain.Preferences;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Preferences.Common;

/// <summary>Runtime-supported regional IANA zones, independent of browser time-zone data.</summary>
public interface ITimeZoneCatalogue
{
    IReadOnlyList<string> Zones { get; }
    bool Supports(string timeZone);
}

/// <summary>A separately replaceable business clock; authentication continues to use real time.</summary>
public interface IBusinessClock
{
    DateTimeOffset UtcNow { get; }
}

/// <summary>One immutable preferences/date snapshot for an operation.</summary>
public sealed record AccountContext(DateOnly PurchaseDate, string TimeZone, string DefaultCurrency, long Revision);

/// <summary>Asynchronously captures preferences and a single business instant.</summary>
public interface IAccountContextReader
{
    Task<Result<AccountContext>> ReadAsync(Guid ownerId, CancellationToken cancellationToken);
}

/// <summary>Public financial context; integer revisions use lossless decimal-string transport.</summary>
public sealed record PreferencesResponse(string TimeZone, string DefaultCurrency, IReadOnlyList<string> RecentCurrencies,
    string Revision, DateOnly? PurchaseDate)
{
    public static PreferencesResponse FromPreferences(AccountPreferences preferences, DateOnly? today)
    {
        ArgumentNullException.ThrowIfNull(preferences);
        return new(preferences.TimeZone, preferences.DefaultCurrency, preferences.RecentCurrencies,
            preferences.Revision.ToString(CultureInfo.InvariantCulture), today);
    }
}

public static class PreferenceErrors
{
    public static readonly UseCaseError Unauthorized = new("preferences.unauthorized", "An authenticated account is required.", UseCaseErrorType.Unauthorized);
    public static readonly UseCaseError NotFound = new("preferences.not_found", "Account settings are unavailable. Try signing in again.", UseCaseErrorType.NotFound);
    public static readonly UseCaseError InvalidInput = new("preferences.invalid_input", "Choose a supported regional time zone and reload the current settings before saving.", UseCaseErrorType.Validation);
    public static readonly UseCaseError UnavailableZone = new("preferences.unavailable_zone", "Your saved time zone is unavailable on this server. Open Settings and choose a supported time zone.", UseCaseErrorType.Conflict);
    public static readonly UseCaseError Conflict = new("preferences.conflict", "Settings changed in another session. Reload settings, review your choice, and save again.", UseCaseErrorType.Conflict);
}
