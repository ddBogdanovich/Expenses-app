namespace PocketLedger.UseCases.Common;

/// <summary>Provides the account identity from the authenticated execution context, never request JSON.</summary>
public interface ICurrentAccount
{
    Guid? AccountId { get; }
}
