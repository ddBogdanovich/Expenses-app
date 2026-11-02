using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;

namespace PocketLedger.UseCases.Expenses.Today;

public sealed record TodayExpenseRequest
{
    public static TodayExpenseRequest Instance { get; } = new();
}

public sealed record TodayExpenseResponse(DateOnly PurchaseDate, string TotalGrosz);

public sealed class TodayExpenseHandler(IExpenseQueries expenses, ICurrentAccount account, IBusinessCalendar calendar)
    : IUseCaseHandler<TodayExpenseRequest, TodayExpenseResponse>
{
    public async Task<Result<TodayExpenseResponse>> HandleAsync(TodayExpenseRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (account.AccountId is not { } ownerId)
        {
            return Result.Failure<TodayExpenseResponse>(ExpenseErrors.Unauthorized);
        }

        var date = calendar.Today;
        var total = await expenses.TotalGroszAsync(ownerId, date, cancellationToken).ConfigureAwait(false);
        return Result.Success(new TodayExpenseResponse(date, total));
    }
}
