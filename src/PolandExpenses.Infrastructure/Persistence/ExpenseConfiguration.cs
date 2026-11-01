using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PolandExpenses.Domain;
using PolandExpenses.Domain.Accounts;
using PolandExpenses.Domain.Expenses;

namespace PolandExpenses.Infrastructure.Persistence;

internal sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> builder)
    {
        builder.ToTable("Expenses", table => table.HasCheckConstraint("CK_Expenses_PositiveAmount", "\"AmountGrosz\" > 0"));
        builder.HasKey(expense => expense.Id);
        builder.Property(expense => expense.Amount).HasColumnName("AmountGrosz").HasConversion(amount => amount.Grosz, grosz => new Money(grosz));
        builder.Property(expense => expense.Category).IsRequired();
        builder.HasIndex(expense => new { expense.OwnerId, expense.PurchaseDate });
        builder.HasOne<UserAccount>().WithMany().HasForeignKey(expense => expense.OwnerId).OnDelete(DeleteBehavior.Restrict);
        // Include ownership in UPDATE/DELETE predicates as well as in aggregate loading.
        builder.Property(expense => expense.OwnerId).IsConcurrencyToken();
    }
}
