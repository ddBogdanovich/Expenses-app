using PocketLedger.Domain.Preferences;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;
using PocketLedger.UseCases.Preferences.Common;
using PocketLedger.UseCases.Preferences.Read;
using PocketLedger.UseCases.Preferences.TimeZones;
using PocketLedger.UseCases.Preferences.Update;

namespace PocketLedger.UseCases.Tests;

/// <summary>Application boundaries must remain safe even when invoked outside MVC's authorization filter.</summary>
public sealed class PreferencesHandlerTests
{
    [Fact]
    public async Task UnauthenticatedCallsCannotReadCatalogueOrLoadOrSavePreferencesAsync()
    {
        var repository = new PreferencesRepository(AccountPreferences.Create(Guid.NewGuid()));
        var account = new CurrentAccount(null);
        var get = new GetPreferencesHandler(repository, account, new Calendar(), new Clock(), new SupportedZones());
        var update = new UpdatePreferencesHandler(repository, account, new SupportedZones(), new Calendar(), new Clock());
        var catalogue = new TimeZonesHandler(new SupportedZones(), account);
        Assert.Equal(UseCaseErrorType.Unauthorized, (await get.HandleAsync(GetPreferencesRequest.Instance, CancellationToken.None)).Error?.Type);
        Assert.Equal(UseCaseErrorType.Unauthorized, (await update.HandleAsync(new("America/Los_Angeles", "0"), CancellationToken.None)).Error?.Type);
        Assert.Equal(UseCaseErrorType.Unauthorized, (await catalogue.HandleAsync(TimeZonesRequest.Instance, CancellationToken.None)).Error?.Type);
        Assert.Equal(0, repository.Reads);
        Assert.Equal(0, repository.Saves);
    }

    [Fact]
    public async Task MissingPreferencesAreReportedWithoutInventingNewAccountDefaultsAsync()
    {
        var repository = new PreferencesRepository(null);
        var account = new CurrentAccount(Guid.NewGuid());
        var get = new GetPreferencesHandler(repository, account, new Calendar(), new Clock(), new SupportedZones());
        var update = new UpdatePreferencesHandler(repository, account, new SupportedZones(), new Calendar(), new Clock());
        Assert.Equal(UseCaseErrorType.NotFound, (await get.HandleAsync(GetPreferencesRequest.Instance, CancellationToken.None)).Error?.Type);
        Assert.Equal(UseCaseErrorType.NotFound, (await update.HandleAsync(new("America/Los_Angeles", "0"), CancellationToken.None)).Error?.Type);
        Assert.Equal(0, repository.Saves);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("-1")]
    [InlineData("not-a-revision")]
    [InlineData("9223372036854775808")]
    public async Task InvalidRevisionCannotLoadOrMutatePreferencesAsync(string? revision)
    {
        var preferences = AccountPreferences.Create(Guid.NewGuid());
        var repository = new PreferencesRepository(preferences);
        var handler = new UpdatePreferencesHandler(repository, new CurrentAccount(preferences.OwnerId), new SupportedZones(), new Calendar(), new Clock());
        var result = await handler.HandleAsync(new("America/Los_Angeles", revision), CancellationToken.None);
        Assert.Equal(UseCaseErrorType.Validation, result.Error?.Type);
        Assert.Equal("Europe/Warsaw", preferences.TimeZone);
        Assert.Equal(0, preferences.Revision);
        Assert.Equal(0, repository.Reads);
        Assert.Equal(0, repository.Saves);
    }

    [Fact]
    public async Task AConcurrentSaveFailureReturnsConflictInsteadOfClaimingPersistenceAsync()
    {
        var preferences = AccountPreferences.Create(Guid.NewGuid());
        var repository = new PreferencesRepository(preferences, saveSucceeds: false);
        var handler = new UpdatePreferencesHandler(repository, new CurrentAccount(preferences.OwnerId), new SupportedZones(), new Calendar(), new Clock());
        var result = await handler.HandleAsync(new("America/Los_Angeles", "0"), CancellationToken.None);
        Assert.True(result.IsFailure);
        Assert.Equal(UseCaseErrorType.Conflict, result.Error?.Type);
        Assert.Equal(1, repository.Saves);
    }

    private sealed record CurrentAccount(Guid? AccountId) : ICurrentAccount;

    private sealed class Calendar : IBusinessCalendar
    {
        public DateOnly TodayIn(string timeZone, DateTimeOffset instant) => new(2026, 11, 8);
    }

    private sealed class Clock : IBusinessClock
    {
        public DateTimeOffset UtcNow => new(2026, 11, 8, 0, 30, 0, TimeSpan.Zero);
    }

    private sealed class SupportedZones : ITimeZoneCatalogue
    {
        public IReadOnlyList<string> Zones { get; } = ["Europe/Warsaw", "America/Los_Angeles"];
        public bool Supports(string timeZone) => Zones.Contains(timeZone, StringComparer.Ordinal);
    }

    private sealed class PreferencesRepository(AccountPreferences? existing, bool saveSucceeds = true) : IAccountPreferencesRepository
    {
        internal int Reads { get; private set; }
        internal int Saves { get; private set; }

        public Task<AccountPreferences?> FindAsync(Guid ownerId, CancellationToken cancellationToken)
        {
            Reads++;
            if (existing is not null) Assert.Equal(existing.OwnerId, ownerId);
            return Task.FromResult(existing);
        }

        public Task<bool> SaveAsync(AccountPreferences preferences, CancellationToken cancellationToken)
        {
            Assert.Same(existing, preferences);
            Saves++;
            return Task.FromResult(saveSucceeds);
        }
    }
}
