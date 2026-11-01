using PocketLedger.Domain;
using PocketLedger.Domain.Expenses;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;

namespace PocketLedger.UseCases.Expenses.GetById;

public sealed class GetExpenseHandler(IExpenseQueries expenses, ICurrentAccount account) : IUseCaseHandler<Guid, ExpenseResponse>
{
    public async Task<Result<ExpenseResponse>> HandleAsync(Guid request, CancellationToken cancellationToken)
    {
        if (account.AccountId is not { } ownerId)
        {
            return Result.Failure<ExpenseResponse>(ExpenseErrors.Unauthorized);
        }

        var expense = await expenses.FindAsync(ownerId, request, cancellationToken).ConfigureAwait(false);
        return expense is null ? Result.Failure<ExpenseResponse>(ExpenseErrors.NotFound) : Result.Success(expense);
    }
}
