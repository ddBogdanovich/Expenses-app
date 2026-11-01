namespace PolandExpenses.Domain.Accounts;

/// <summary>Stores account aggregates; insertion enforces unique email atomically.</summary>
public interface IUserAccountRepository
{
    Task<UserAccount?> FindByEmailAsync(EmailAddress email, CancellationToken cancellationToken);

    Task<bool> TryAddAsync(UserAccount account, CancellationToken cancellationToken);
}
