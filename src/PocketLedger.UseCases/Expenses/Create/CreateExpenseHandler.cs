using PocketLedger.Domain;
using PocketLedger.Domain.Expenses;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;
using PocketLedger.UseCases.Preferences.Common;

namespace PocketLedger.UseCases.Expenses.Create;

public sealed class CreateExpenseHandler(IExpenseRepository expenses, ICurrentAccount account, IAccountContextReader contexts)
    : IUseCaseHandler<ExpenseInput, ExpenseResponse>
{
    public async Task<Result<ExpenseResponse>> HandleAsync(ExpenseInput request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (account.AccountId is not { } ownerId)
        {
            return Result.Failure<ExpenseResponse>(ExpenseErrors.Unauthorized);
        }

        var context = await contexts.ReadAsync(ownerId, cancellationToken).ConfigureAwait(false);
        if (context.IsFailure)
        {
            return Result.Failure<ExpenseResponse>(context.Error!);
        }

        if (!request.HasRequiredFields || !Expense.TryCreate(ownerId, new Money(request.AmountGrosz!.Value), request.PurchaseDate!.Value,
            request.Category, request.Note, request.QualifiesForAllowance!.Value, context.Value.PurchaseDate, out var expense))
        {
            return Result.Failure<ExpenseResponse>(ExpenseErrors.InvalidInput);
        }

        await expenses.AddAsync(expense, cancellationToken).ConfigureAwait(false);
        return Result.Success(ExpenseResponse.FromExpense(expense));
    }
}
