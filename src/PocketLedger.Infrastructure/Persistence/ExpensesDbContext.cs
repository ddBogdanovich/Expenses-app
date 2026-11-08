using Microsoft.EntityFrameworkCore;
using PocketLedger.Infrastructure.Authentication.Preview;

namespace PocketLedger.Infrastructure.Persistence;

public sealed class ExpensesDbContext(DbContextOptions<ExpensesDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfiguration(new UserAccountConfiguration());
        modelBuilder.ApplyConfiguration(new ExpenseConfiguration());
        modelBuilder.ApplyConfiguration(new AccountPreferencesConfiguration());
        modelBuilder.Entity<BrowserSession>(session =>
        {
            session.ToTable("BrowserSessions");
            session.HasKey(value => value.Id);
            session.Property(value => value.ProtectedTicket).IsRequired();
            session.HasIndex(value => value.ExpiresUtc);
        });
    }
}
