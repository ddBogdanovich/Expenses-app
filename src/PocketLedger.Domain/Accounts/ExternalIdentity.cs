namespace PocketLedger.Domain.Accounts;

/// <summary>An opaque provider subject scoped to its exact issuer.</summary>
public sealed record ExternalIdentity
{
    public const int MaximumIssuerLength = 2048;
    public const int MaximumSubjectLength = 255;

    private ExternalIdentity(string issuer, string subject)
    {
        Issuer = issuer;
        Subject = subject;
    }

    public string Issuer { get; private set; }

    public string Subject { get; private set; }

    public static ExternalIdentity Create(string issuer, string subject)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(issuer);
        ArgumentException.ThrowIfNullOrWhiteSpace(subject);
        if (issuer.Length > MaximumIssuerLength || subject.Length > MaximumSubjectLength)
        {
            throw new ArgumentException("External identity exceeds its supported storage bounds.");
        }

        return new ExternalIdentity(issuer, subject);
    }
}
