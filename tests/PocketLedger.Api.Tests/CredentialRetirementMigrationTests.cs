using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using PocketLedger.Domain.Accounts;
using PocketLedger.Infrastructure.Persistence;
using PocketLedger.UseCases.Authentication.ResolveExternalAccount;

namespace PocketLedger.Api.Tests;

/// <summary>Upgrades a real pre-cutover database containing both identity kinds and owned data.</summary>
public sealed class CredentialRetirementMigrationTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    [Fact]
    public async Task CutoverPreservesOwnersExpensesExternalIdentityAndSessionsWithoutLinkingEmailAsync()
    {
        var legacyId = Guid.NewGuid();
        var externalId = Guid.NewGuid();
        var legacyExpense = Guid.NewGuid();
        var externalExpense = Guid.NewGuid();
        const string email = "RETAINED@EXAMPLE.COM";
        const string issuer = "https://identity.example";
        const string subject = "opaque-retained-subject";
        var ticketBytes = new byte[] { 1, 2 };
        var ticketExpiry = DateTimeOffset.UtcNow.AddHours(1);
        // PostgreSQL timestamps retain microseconds, rather than .NET’s 100-nanosecond ticks.
        ticketExpiry = new DateTimeOffset(ticketExpiry.Ticks - ticketExpiry.Ticks % 10, TimeSpan.Zero);
        using (var context = new ExpensesDbContext(new DbContextOptionsBuilder<ExpensesDbContext>().UseNpgsql(database.ConnectionString).Options))
        {
            var migrator = context.GetService<IMigrator>();
            await migrator.MigrateAsync("20261104195921_ExternalAccountsAndBrowserSessions");
            await context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"UserAccounts\" (\"Id\", \"Email\", \"PasswordHash\") VALUES ({legacyId}, {email}, {"retained-verifier"})");
            await context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"UserAccounts\" (\"Id\", \"Email\", \"ExternalIssuer\", \"ExternalSubject\") VALUES ({externalId}, {email}, {issuer}, {subject})");
            foreach (var (id, owner) in new[] { (legacyExpense, legacyId), (externalExpense, externalId) })
            {
                await context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"Expenses\" (\"Id\", \"OwnerId\", \"AmountGrosz\", \"PurchaseDate\", \"Category\", \"QualifiesForAllowance\") VALUES ({id}, {owner}, {3500L}, {new DateOnly(2026, 1, 1)}, {"Food"}, {true})");
            }

            await context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO \"BrowserSessions\" (\"Id\", \"ProtectedTicket\", \"ExpiresUtc\") VALUES ({"retained-ticket"}, {ticketBytes}, {ticketExpiry})");
            // Assert this irreversible migration at its own boundary before later additive migrations.
            await migrator.MigrateAsync("20261107224636_RetireLocalPasswordVerifiers");
            var owners = await context.Set<UserAccount>().AsNoTracking().ToListAsync();
            Assert.Equal(2, owners.Count);
            Assert.Null(owners.Single(owner => owner.Id == legacyId).ExternalIdentity);
            Assert.Equal(ExternalIdentity.Create(issuer, subject), owners.Single(owner => owner.Id == externalId).ExternalIdentity);
            var preservedExpenses = await context.Database.SqlQuery<Guid>($"SELECT \"OwnerId\" AS \"Value\" FROM \"Expenses\" ORDER BY \"OwnerId\"").ToListAsync();
            Assert.Equal(new[] { legacyId, externalId }.Order(), preservedExpenses);
            Assert.Equal(2, await context.Database.SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM \"Expenses\" WHERE \"AmountGrosz\" = 3500").SingleAsync());
            Assert.Equal(1, await context.Database.SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM \"BrowserSessions\" WHERE \"Id\" = 'retained-ticket'").SingleAsync());
            Assert.Equal(ticketBytes, await context.Database.SqlQuery<byte[]>($"SELECT \"ProtectedTicket\" AS \"Value\" FROM \"BrowserSessions\" WHERE \"Id\" = 'retained-ticket'").SingleAsync());
            Assert.Equal(ticketExpiry, await context.Database.SqlQuery<DateTimeOffset>($"SELECT \"ExpiresUtc\" AS \"Value\" FROM \"BrowserSessions\" WHERE \"Id\" = 'retained-ticket'").SingleAsync());
            var applied = (await context.Database.GetAppliedMigrationsAsync()).ToArray();
            var downgrade = await Assert.ThrowsAsync<PostgresException>(() => migrator.MigrateAsync("20261104195921_ExternalAccountsAndBrowserSessions"));
            Assert.Equal(PostgresErrorCodes.RaiseException, downgrade.SqlState);
            Assert.Equal(applied, await context.Database.GetAppliedMigrationsAsync());
            Assert.Equal(2, await context.Set<UserAccount>().CountAsync());
            Assert.Equal(0, await context.Database.SqlQuery<int>($"SELECT count(*)::int AS \"Value\" FROM information_schema.columns WHERE table_name = 'UserAccounts' AND column_name = 'PasswordHash'").SingleAsync());
            await migrator.MigrateAsync();
        }

        using var application = database.CreateApplication();
        using var scope = application.Services.CreateScope();
        var handler = scope.ServiceProvider.GetRequiredService<ResolveExternalAccountHandler>();
        var existing = await handler.HandleAsync(new(issuer, subject, email), CancellationToken.None);
        Assert.Equal(externalId, existing.Value);
        var fresh = await handler.HandleAsync(new(issuer, "fresh-subject", email), CancellationToken.None);
        Assert.True(fresh.IsSuccess);
        Assert.NotEqual(legacyId, fresh.Value);
        Assert.NotEqual(externalId, fresh.Value);
    }
}
