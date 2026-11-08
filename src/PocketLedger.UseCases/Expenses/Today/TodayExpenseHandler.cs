using System.Globalization;
using PocketLedger.Domain.Preferences;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;
using PocketLedger.UseCases.Preferences.Common;

namespace PocketLedger.UseCases.Expenses.Today;

public sealed record TodayExpenseRequest
{
    public static TodayExpenseRequest Instance { get; } = new();
}

public sealed record CurrencyTotal(string Currency, string AmountMinorUnits);
public sealed record TodayExpenseResponse(DateOnly PurchaseDate, string TimeZone, string PreferencesRevision,
    string DefaultCurrency, bool HasExpenses, IReadOnlyList<CurrencyTotal> Totals);

public sealed class TodayExpenseHandler(IExpenseQueries expenses, ICurrentAccount account, IAccountContextReader contexts)
    : IUseCaseHandler<TodayExpenseRequest, TodayExpenseResponse>
{
    public async Task<Result<TodayExpenseResponse>> HandleAsync(TodayExpenseRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (account.AccountId is not { } ownerId)
        {
            return Result.Failure<TodayExpenseResponse>(ExpenseErrors.Unauthorized);
        }

        var context = await contexts.ReadAsync(ownerId, cancellationToken).ConfigureAwait(false);
        if (context.IsFailure)
        {
            return Result.Failure<TodayExpenseResponse>(context.Error!);
        }

        var captured = context.Value;
        var total = await expenses.TotalGroszAsync(ownerId, captured.PurchaseDate, cancellationToken).ConfigureAwait(false);
        // Positive PLN expenses mean zero exactly identifies an empty day in this phase.
        return Result.Success(new TodayExpenseResponse(captured.PurchaseDate, captured.TimeZone,
            captured.Revision.ToString(CultureInfo.InvariantCulture), captured.DefaultCurrency, total != "0",
            [new CurrencyTotal(total == "0" ? captured.DefaultCurrency : AccountPreferences.InitialCurrency, total)]));
    }
}
