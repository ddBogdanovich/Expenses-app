using PocketLedger.Domain.Preferences;

namespace PocketLedger.Domain.Tests;

public sealed class AccountPreferencesTests
{
    [Fact]
    public void PreferencesRequireAnOwnerAndPreserveDefaultsWhenInvalidChangesAreRejected()
    {
        Assert.Throws<ArgumentException>(() => AccountPreferences.Create(Guid.Empty));
        var owner = Guid.NewGuid();
        var preferences = AccountPreferences.Create(owner);
        Assert.Throws<ArgumentException>(() => preferences.ChangeTimeZone(" "));
        Assert.Throws<ArgumentOutOfRangeException>(() => preferences.ChangeTimeZone(new string('a', AccountPreferences.MaximumTimeZoneLength + 1)));
        Assert.Equal(owner, preferences.OwnerId);
        Assert.Equal("Europe/Warsaw", preferences.TimeZone);
        Assert.Equal("PLN", preferences.DefaultCurrency);
        Assert.Empty(preferences.RecentCurrencies);
        Assert.Equal(0, preferences.Revision);
    }

    [Fact]
    public void AZoneChangeAdvancesOnlyItsOwnRevisionAndKeepsCurrencyIntentUntouched()
    {
        var preferences = AccountPreferences.Create(Guid.NewGuid());
        preferences.ChangeTimeZone("America/Los_Angeles");
        Assert.Equal("America/Los_Angeles", preferences.TimeZone);
        Assert.Equal(1, preferences.Revision);
        Assert.Equal("PLN", preferences.DefaultCurrency);
        Assert.Empty(preferences.RecentCurrencies);
    }
}
