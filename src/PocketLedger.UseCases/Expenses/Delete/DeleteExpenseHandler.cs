using PocketLedger.Domain;
using PocketLedger.Domain.Expenses;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;

namespace PocketLedger.UseCases.Expenses.Delete;

public sealed class DeleteExpenseHandler(IExpenseRepository expenses, ICurrentAccount account) : IUseCaseHandler<Guid, bool>
{
    public async Task<Result<bool>> HandleAsync(Guid request, CancellationToken cancellationToken)
    {
        if (account.AccountId is not { } ownerId)
        {
            return Result.Failure<bool>(ExpenseErrors.Unauthorized);
        }

        var expense = await expenses.FindAsync(ownerId, request, cancellationToken).ConfigureAwait(false);
        if (expense is null)
        {
            return Result.Failure<bool>(ExpenseErrors.NotFound);
        }

        return await expenses.DeleteAsync(expense, cancellationToken).ConfigureAwait(false)
            ? Result.Success(true)
            : Result.Failure<bool>(ExpenseErrors.Conflict);
    }
}
