using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using PocketLedger.Domain.Preferences;
using PocketLedger.Infrastructure.Persistence;

namespace PocketLedger.Api.Tests;

/// <summary>Proves upgrade defaults and exact preservation of populated pre-feature business rows.</summary>
public sealed class PreferencesMigrationTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    [Fact]
    public async Task UpgradeBackfillsBothIdentityKindsAndPreservesEveryExpenseFieldAsync()
    {
        using var context = new ExpensesDbContext(new DbContextOptionsBuilder<ExpensesDbContext>().UseNpgsql(database.ConnectionString).Options);
        var migrator = context.GetService<IMigrator>();
        await migrator.MigrateAsync("20261107224636_RetireLocalPasswordVerifiers");
        var legacy = Guid.NewGuid();
        var external = Guid.NewGuid();
        await context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"UserAccounts\" (\"Id\", \"Email\") VALUES ({legacy}, {"LEGACY@EXAMPLE.COM"})");
        await context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"UserAccounts\" (\"Id\", \"Email\", \"ExternalIssuer\", \"ExternalSubject\") VALUES ({external}, {"OWNER@EXAMPLE.COM"}, {"https://identity.example"}, {"retained-subject"})");
        foreach (var owner in new[] { legacy, external })
        {
            await context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"Expenses\" (\"Id\", \"OwnerId\", \"AmountGrosz\", \"PurchaseDate\", \"Category\", \"Note\", \"QualifiesForAllowance\") VALUES ({Guid.NewGuid()}, {owner}, {long.MaxValue}, {new DateOnly(2025, 12, 31)}, {"Transport"}, {"Unchanged history"}, {false})");
        }

        var before = await context.Database.SqlQuery<string>($"SELECT row_to_json(e)::text AS \"Value\" FROM \"Expenses\" e ORDER BY \"Id\"").ToArrayAsync();
        await migrator.MigrateAsync();
        var defaults = await context.Set<AccountPreferences>().ToListAsync();
        Assert.Equal(new[] { legacy, external }.Order(), defaults.Select(value => value.OwnerId).Order());
        Assert.All(defaults, value =>
        {
            Assert.Equal("PLN", value.DefaultCurrency);
            Assert.Equal("Europe/Warsaw", value.TimeZone);
            Assert.Empty(value.RecentCurrencies);
            Assert.Equal(0, value.Revision);
        });
        defaults[0].ChangeTimeZone("Pacific/Kiritimati");
        await context.SaveChangesAsync();
        defaults[0].ChangeTimeZone("America/Los_Angeles");
        await context.SaveChangesAsync();
        var after = await context.Database.SqlQuery<string>($"SELECT row_to_json(e)::text AS \"Value\" FROM \"Expenses\" e ORDER BY \"Id\"").ToArrayAsync();
        Assert.Equal(before, after);
        context.ChangeTracker.Clear();
        Assert.Equal("America/Los_Angeles", (await context.Set<AccountPreferences>().SingleAsync(value => value.OwnerId == defaults[0].OwnerId)).TimeZone);
    }
}
