using PolandExpenses.Domain;
using PolandExpenses.Domain.Expenses;
using PolandExpenses.UseCases.Common;
using PolandExpenses.UseCases.Expenses.Common;

namespace PolandExpenses.UseCases.Expenses.Update;

public sealed record UpdateExpenseRequest(Guid Id, ExpenseInput Expense);

public sealed class UpdateExpenseHandler(IExpenseRepository expenses, ICurrentAccount account, IBusinessCalendar calendar)
    : IUseCaseHandler<UpdateExpenseRequest, ExpenseResponse>
{
    public async Task<Result<ExpenseResponse>> HandleAsync(UpdateExpenseRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(request.Expense);
        if (account.AccountId is not { } ownerId)
        {
            return Result.Failure<ExpenseResponse>(ExpenseErrors.Unauthorized);
        }

        var expense = await expenses.FindAsync(ownerId, request.Id, cancellationToken).ConfigureAwait(false);
        if (expense is null)
        {
            return Result.Failure<ExpenseResponse>(ExpenseErrors.NotFound);
        }

        var input = request.Expense;
        if (!input.HasRequiredFields || !expense.TryUpdate(new Money(input.AmountGrosz!.Value), input.PurchaseDate!.Value,
            input.Category, input.Note, input.QualifiesForAllowance!.Value, calendar.Today))
        {
            return Result.Failure<ExpenseResponse>(ExpenseErrors.InvalidInput);
        }

        return await expenses.SaveAsync(expense, cancellationToken).ConfigureAwait(false)
            ? Result.Success(ExpenseResponse.FromExpense(expense))
            : Result.Failure<ExpenseResponse>(ExpenseErrors.Conflict);
    }
}
