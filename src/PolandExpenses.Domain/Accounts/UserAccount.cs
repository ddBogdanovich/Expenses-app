namespace PolandExpenses.Domain.Accounts;

/// <summary>The account aggregate owns identity and a password verifier, never a plaintext password.</summary>
public sealed class UserAccount
{
    private UserAccount(Guid id, EmailAddress email, string passwordHash)
    {
        Id = id;
        Email = email;
        PasswordHash = passwordHash;
    }

    public Guid Id { get; private set; }

    public EmailAddress Email { get; private set; }

    public string PasswordHash { get; private set; }

    public static UserAccount Register(EmailAddress email, string passwordHash)
    {
        ArgumentNullException.ThrowIfNull(email);
        ArgumentException.ThrowIfNullOrWhiteSpace(passwordHash);
        return new UserAccount(Guid.NewGuid(), email, passwordHash);
    }
}
