namespace PocketLedger.Domain.Accounts;

/// <summary>Owns a stable local identity. Retained legacy rows have no external identity and cannot sign in.</summary>
public sealed class UserAccount
{
    private UserAccount(Guid id, EmailAddress email)
    {
        Id = id;
        Email = email;
    }

    public Guid Id { get; private set; }

    public EmailAddress Email { get; private set; }

    public ExternalIdentity? ExternalIdentity { get; private set; }

    public static UserAccount Provision(EmailAddress email, ExternalIdentity identity)
    {
        ArgumentNullException.ThrowIfNull(email);
        ArgumentNullException.ThrowIfNull(identity);
        return new UserAccount(Guid.NewGuid(), email) { ExternalIdentity = identity };
    }
}
