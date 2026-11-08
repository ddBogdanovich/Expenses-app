using System.Globalization;
using PocketLedger.Domain.Preferences;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;
using PocketLedger.UseCases.Preferences.Common;

namespace PocketLedger.UseCases.Preferences.Update;

public sealed record UpdatePreferencesRequest(string? TimeZone, string? ExpectedRevision);

public sealed class UpdatePreferencesHandler(IAccountPreferencesRepository preferences, ICurrentAccount account,
    ITimeZoneCatalogue zones, IBusinessCalendar calendar, IBusinessClock clock)
    : IUseCaseHandler<UpdatePreferencesRequest, PreferencesResponse>
{
    public async Task<Result<PreferencesResponse>> HandleAsync(UpdatePreferencesRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (account.AccountId is not { } ownerId)
        {
            return Result.Failure<PreferencesResponse>(PreferenceErrors.Unauthorized);
        }

        if (request.TimeZone is null || !zones.Supports(request.TimeZone) ||
            !long.TryParse(request.ExpectedRevision, NumberStyles.None, CultureInfo.InvariantCulture, out var revision))
        {
            return Result.Failure<PreferencesResponse>(PreferenceErrors.InvalidInput);
        }

        var saved = await preferences.FindAsync(ownerId, cancellationToken).ConfigureAwait(false);
        if (saved is null)
        {
            return Result.Failure<PreferencesResponse>(PreferenceErrors.NotFound);
        }

        if (saved.Revision != revision)
        {
            return Result.Failure<PreferencesResponse>(PreferenceErrors.Conflict);
        }

        saved.ChangeTimeZone(request.TimeZone);
        if (!await preferences.SaveAsync(saved, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<PreferencesResponse>(PreferenceErrors.Conflict);
        }

        return Result.Success(PreferencesResponse.FromPreferences(saved, calendar.TodayIn(saved.TimeZone, clock.UtcNow)));
    }
}
