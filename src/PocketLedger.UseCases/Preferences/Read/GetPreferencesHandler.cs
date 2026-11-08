using PocketLedger.Domain.Preferences;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;
using PocketLedger.UseCases.Preferences.Common;

namespace PocketLedger.UseCases.Preferences.Read;

public sealed record GetPreferencesRequest
{
    public static GetPreferencesRequest Instance { get; } = new();
}

public sealed class GetPreferencesHandler(IAccountPreferencesRepository preferences, ICurrentAccount account,
    IBusinessCalendar calendar, IBusinessClock clock, ITimeZoneCatalogue zones)
    : IUseCaseHandler<GetPreferencesRequest, PreferencesResponse>
{
    public async Task<Result<PreferencesResponse>> HandleAsync(GetPreferencesRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (account.AccountId is not { } ownerId)
        {
            return Result.Failure<PreferencesResponse>(PreferenceErrors.Unauthorized);
        }

        var saved = await preferences.FindAsync(ownerId, cancellationToken).ConfigureAwait(false);
        if (saved is null)
        {
            return Result.Failure<PreferencesResponse>(PreferenceErrors.NotFound);
        }

        // Keep Settings readable even when a formerly supported zone disappears, so it can be repaired.
        var today = zones.Supports(saved.TimeZone) ? calendar.TodayIn(saved.TimeZone, clock.UtcNow) : (DateOnly?)null;
        return Result.Success(PreferencesResponse.FromPreferences(saved, today));
    }
}
