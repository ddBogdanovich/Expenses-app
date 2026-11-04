namespace PocketLedger.Domain.Accounts;

/// <summary>The account owns a stable local identity and either an external identity or a legacy password verifier.</summary>
public sealed class UserAccount
{
    private UserAccount(Guid id, EmailAddress email, string? passwordHash)
    {
        Id = id;
        Email = email;
        PasswordHash = passwordHash;
    }

    public Guid Id { get; private set; }

    public EmailAddress Email { get; private set; }

    public string? PasswordHash { get; private set; }

    public ExternalIdentity? ExternalIdentity { get; private set; }

    public static UserAccount Provision(EmailAddress email, ExternalIdentity identity)
    {
        ArgumentNullException.ThrowIfNull(email);
        ArgumentNullException.ThrowIfNull(identity);
        return new UserAccount(Guid.NewGuid(), email, null) { ExternalIdentity = identity };
    }

    public static UserAccount Register(EmailAddress email, string passwordHash)
    {
        ArgumentNullException.ThrowIfNull(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(passwordHash);
        return new UserAccount(Guid.NewGuid(), email, passwordHash);
    }
}
