using Microsoft.EntityFrameworkCore;
using PocketLedger.Domain.Preferences;
using PocketLedger.Infrastructure.Persistence;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;
using PocketLedger.UseCases.Preferences.Common;

namespace PocketLedger.Infrastructure.Preferences;

internal sealed class TimeZoneCatalogue : ITimeZoneCatalogue
{
    private readonly HashSet<string> _zones = TimeZoneInfo.GetSystemTimeZones()
        .Where(zone => zone.HasIanaId && zone.Id.Contains('/', StringComparison.Ordinal) &&
            !zone.Id.StartsWith("Etc/", StringComparison.Ordinal) && !zone.Id.StartsWith("SystemV/", StringComparison.Ordinal) &&
            zone.Id.Length <= AccountPreferences.MaximumTimeZoneLength)
        .Select(zone => zone.Id).ToHashSet(StringComparer.Ordinal);

    public TimeZoneCatalogue()
    {
        Zones = Array.AsReadOnly(_zones.Order(StringComparer.Ordinal).ToArray());
    }

    public IReadOnlyList<string> Zones { get; }
    public bool Supports(string timeZone) => _zones.Contains(timeZone);
}

internal sealed class BusinessClock(TimeProvider timeProvider) : IBusinessClock
{
    public DateTimeOffset UtcNow => timeProvider.GetUtcNow();
}

internal sealed class RegionalBusinessCalendar : IBusinessCalendar
{
    public DateOnly TodayIn(string timeZone, DateTimeOffset instant) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, TimeZoneInfo.FindSystemTimeZoneById(timeZone)).DateTime);
}

internal sealed class AccountContextReader(IAccountPreferencesRepository preferences, IBusinessCalendar calendar,
    IBusinessClock clock, ITimeZoneCatalogue zones) : IAccountContextReader
{
    public async Task<Result<AccountContext>> ReadAsync(Guid ownerId, CancellationToken cancellationToken)
    {
        var saved = await preferences.FindAsync(ownerId, cancellationToken).ConfigureAwait(false);
        if (saved is null)
        {
            return Result.Failure<AccountContext>(PreferenceErrors.NotFound);
        }

        if (!zones.Supports(saved.TimeZone))
        {
            return Result.Failure<AccountContext>(PreferenceErrors.UnavailableZone);
        }

        var date = calendar.TodayIn(saved.TimeZone, clock.UtcNow);
        return Result.Success(new AccountContext(date, saved.TimeZone, saved.DefaultCurrency, saved.Revision));
    }
}

internal sealed class AccountPreferencesRepository(ExpensesDbContext context) : IAccountPreferencesRepository
{
    public Task<AccountPreferences?> FindAsync(Guid ownerId, CancellationToken cancellationToken) =>
        context.Set<AccountPreferences>().SingleOrDefaultAsync(value => value.OwnerId == ownerId, cancellationToken);

    public async Task<bool> SaveAsync(AccountPreferences preferences, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(preferences);
        try
        {
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            context.ChangeTracker.Clear();
            return false;
        }
    }
}
