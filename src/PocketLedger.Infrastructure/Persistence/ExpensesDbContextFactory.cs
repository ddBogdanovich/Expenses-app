using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PocketLedger.Infrastructure.Persistence;

/// <summary>Enables migration generation without starting the API or supplying real credentials.</summary>
public sealed class ExpensesDbContextFactory : IDesignTimeDbContextFactory<ExpensesDbContext>
{
    public ExpensesDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<ExpensesDbContext>()
        .UseNpgsql("Host=localhost;Database=expenses_design_only").Options);
}
