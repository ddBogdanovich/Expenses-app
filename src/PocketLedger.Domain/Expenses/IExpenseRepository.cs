namespace PocketLedger.Domain.Expenses;

/// <summary>Loads and persists expense aggregates within an explicit owner boundary.</summary>
public interface IExpenseRepository
{
    Task<Expense?> FindAsync(Guid ownerId, Guid expenseId, CancellationToken cancellationToken);
    Task AddAsync(Expense expense, CancellationToken cancellationToken);
    Task<bool> SaveAsync(Expense expense, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Expense expense, CancellationToken cancellationToken);
}
