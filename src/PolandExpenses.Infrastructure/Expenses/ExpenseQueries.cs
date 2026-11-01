using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using PolandExpenses.Domain.Expenses;
using PolandExpenses.Infrastructure.Persistence;
using PolandExpenses.UseCases.Expenses.Common;

namespace PolandExpenses.Infrastructure.Expenses;

internal sealed class ExpenseQueries(ExpensesDbContext context) : IExpenseQueries
{
    private static readonly Expression<Func<Expense, ExpenseResponse>> Projection = expense => new ExpenseResponse(
        expense.Id, expense.Amount.Grosz, expense.PurchaseDate, expense.Category, expense.Note, expense.QualifiesForAllowance);

    public Task<ExpenseResponse?> FindAsync(Guid ownerId, Guid expenseId, CancellationToken cancellationToken) =>
        context.Set<Expense>().AsNoTracking().Where(expense => expense.OwnerId == ownerId && expense.Id == expenseId)
            .Select(Projection).SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<ExpenseResponse>> ListAsync(Guid ownerId, CancellationToken cancellationToken) =>
        await context.Set<Expense>().AsNoTracking().Where(expense => expense.OwnerId == ownerId)
            .OrderByDescending(expense => expense.PurchaseDate).ThenBy(expense => expense.Id)
            .Select(Projection).ToListAsync(cancellationToken).ConfigureAwait(false);
}
