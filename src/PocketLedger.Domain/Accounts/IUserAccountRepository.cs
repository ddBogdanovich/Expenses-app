namespace PocketLedger.Domain.Accounts;

/// <summary>Stores account aggregates; insertion atomically enforces legacy email and external identity uniqueness.</summary>
public interface IUserAccountRepository
{
    Task<UserAccount?> FindByEmailAsync(EmailAddress email, CancellationToken cancellationToken);

    Task<UserAccount?> FindByExternalIdentityAsync(ExternalIdentity identity, CancellationToken cancellationToken);

    Task<bool> TryAddAsync(UserAccount account, CancellationToken cancellationToken);
}
