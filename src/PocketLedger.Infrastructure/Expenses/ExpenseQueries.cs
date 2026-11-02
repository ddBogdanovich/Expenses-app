using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using PocketLedger.Domain.Expenses;
using PocketLedger.Infrastructure.Persistence;
using PocketLedger.UseCases.Expenses.Common;

namespace PocketLedger.Infrastructure.Expenses;

internal sealed class ExpenseQueries(ExpensesDbContext context) : IExpenseQueries
{
    private static readonly Expression<Func<Expense, ExpenseResponse>> Projection = expense => new ExpenseResponse(
        expense.Id, expense.Amount.Grosz, expense.PurchaseDate, expense.Category, expense.Note, expense.QualifiesForAllowance);

    // PostgreSQL sums bigint as numeric. Return its integer digits without narrowing the total.
    public Task<string> TotalGroszAsync(Guid ownerId, DateOnly purchaseDate, CancellationToken cancellationToken) =>
        context.Database.SqlQuery<string>($"""
            SELECT COALESCE(SUM("AmountGrosz"), 0)::text AS "Value"
            FROM "Expenses"
            WHERE "OwnerId" = {ownerId} AND "PurchaseDate" = {purchaseDate}
            """).SingleAsync(cancellationToken);

    public Task<ExpenseResponse?> FindAsync(Guid ownerId, Guid expenseId, CancellationToken cancellationToken) =>
        context.Set<Expense>().AsNoTracking().Where(expense => expense.OwnerId == ownerId && expense.Id == expenseId)
            .Select(Projection).SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<ExpenseResponse>> ListAsync(Guid ownerId, CancellationToken cancellationToken) =>
        await context.Set<Expense>().AsNoTracking().Where(expense => expense.OwnerId == ownerId)
            .OrderByDescending(expense => expense.PurchaseDate).ThenBy(expense => expense.Id)
            .Select(Projection).ToListAsync(cancellationToken).ConfigureAwait(false);
}
