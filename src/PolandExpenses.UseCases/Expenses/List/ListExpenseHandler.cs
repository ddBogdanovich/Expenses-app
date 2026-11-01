using PolandExpenses.UseCases.Common;
using PolandExpenses.UseCases.Expenses.Common;

namespace PolandExpenses.UseCases.Expenses.List;

public sealed record ListExpensesRequest
{
    public static ListExpensesRequest All { get; } = new();
}

public sealed class ListExpenseHandler(IExpenseQueries expenses, ICurrentAccount account)
    : IUseCaseHandler<ListExpensesRequest, IReadOnlyList<ExpenseResponse>>
{
    public async Task<Result<IReadOnlyList<ExpenseResponse>>> HandleAsync(ListExpensesRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (account.AccountId is not { } ownerId)
        {
            return Result.Failure<IReadOnlyList<ExpenseResponse>>(ExpenseErrors.Unauthorized);
        }

        return Result.Success(await expenses.ListAsync(ownerId, cancellationToken).ConfigureAwait(false));
    }
}
