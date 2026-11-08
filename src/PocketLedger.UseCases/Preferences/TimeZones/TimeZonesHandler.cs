using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Preferences.Common;

namespace PocketLedger.UseCases.Preferences.TimeZones;

public sealed record TimeZonesRequest
{
    public static TimeZonesRequest Instance { get; } = new();
}

public sealed class TimeZonesHandler(ITimeZoneCatalogue zones, ICurrentAccount account) : IUseCaseHandler<TimeZonesRequest, IReadOnlyList<string>>
{
    public Task<Result<IReadOnlyList<string>>> HandleAsync(TimeZonesRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        return Task.FromResult(account.AccountId.HasValue
            ? Result.Success(zones.Zones)
            : Result.Failure<IReadOnlyList<string>>(PreferenceErrors.Unauthorized));
    }
}
