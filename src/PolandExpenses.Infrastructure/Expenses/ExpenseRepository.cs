using Microsoft.EntityFrameworkCore;
using PolandExpenses.Domain.Expenses;
using PolandExpenses.Infrastructure.Persistence;

namespace PolandExpenses.Infrastructure.Expenses;

internal sealed class ExpenseRepository(ExpensesDbContext context) : IExpenseRepository
{
    public Task<Expense?> FindAsync(Guid ownerId, Guid expenseId, CancellationToken cancellationToken) =>
        context.Set<Expense>().SingleOrDefaultAsync(expense => expense.OwnerId == ownerId && expense.Id == expenseId, cancellationToken);

    public async Task AddAsync(Expense expense, CancellationToken cancellationToken)
    {
        context.Add(expense);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    public Task<bool> SaveAsync(Expense expense, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(expense);
        return SaveChangesAsync(cancellationToken);
    }

    public Task<bool> DeleteAsync(Expense expense, CancellationToken cancellationToken)
    {
        context.Remove(expense);
        return SaveChangesAsync(cancellationToken);
    }

    private async Task<bool> SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }
}
