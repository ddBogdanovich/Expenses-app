using PocketLedger.Domain.Expenses;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Expenses.Common;

/// <summary>Full purchase details for create or replace; nullable values distinguish omitted input.</summary>
public sealed record ExpenseInput(long? AmountGrosz, DateOnly? PurchaseDate, string? Category, string? Note, bool? QualifiesForAllowance)
{
    public bool HasRequiredFields => AmountGrosz.HasValue && PurchaseDate.HasValue && QualifiesForAllowance.HasValue;
}

/// <summary>The public purchase projection, without account or persistence internals.</summary>
public sealed record ExpenseResponse(Guid Id, long AmountGrosz, DateOnly PurchaseDate, string Category, string? Note, bool QualifiesForAllowance)
{
    public static ExpenseResponse FromExpense(Expense expense)
    {
        ArgumentNullException.ThrowIfNull(expense);
        return new(expense.Id, expense.Amount.Grosz, expense.PurchaseDate, expense.Category, expense.Note, expense.QualifiesForAllowance);
    }
}

/// <summary>Read projections filtered by the authenticated owner.</summary>
public interface IExpenseQueries
{
    Task<ExpenseResponse?> FindAsync(Guid ownerId, Guid expenseId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ExpenseResponse>> ListAsync(Guid ownerId, CancellationToken cancellationToken);
}

/// <summary>The current Warsaw business date, separate from server-local time.</summary>
public interface IBusinessCalendar
{
    DateOnly Today { get; }
}

internal static class ExpenseErrors
{
    internal static readonly UseCaseError Unauthorized = new("expenses.unauthorized", "An authenticated account is required.", UseCaseErrorType.Unauthorized);
    internal static readonly UseCaseError InvalidInput = new("expenses.invalid_input", "Supply a positive integer amount in grosz, a non-future purchase date, a nonblank category, and an explicit allowance classification.", UseCaseErrorType.Validation);
    internal static readonly UseCaseError NotFound = new("expenses.not_found", "The expense was not found.", UseCaseErrorType.NotFound);
    internal static readonly UseCaseError Conflict = new("expenses.conflict", "The expense changed or was deleted. Reload and try again.", UseCaseErrorType.Conflict);
}
