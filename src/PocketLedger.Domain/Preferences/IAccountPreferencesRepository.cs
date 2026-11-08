namespace PocketLedger.Domain.Preferences;

/// <summary>Loads and saves the authenticated owner's financial preferences.</summary>
public interface IAccountPreferencesRepository
{
    Task<AccountPreferences?> FindAsync(Guid ownerId, CancellationToken cancellationToken);
    Task<bool> SaveAsync(AccountPreferences preferences, CancellationToken cancellationToken);
}
