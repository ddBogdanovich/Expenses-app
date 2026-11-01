using System.Diagnostics.CodeAnalysis;
using System.Net.Mail;

namespace PolandExpenses.Domain.Accounts;

/// <summary>An account email, compared using the application's case-insensitive identity policy.</summary>
public sealed record EmailAddress
{
    private EmailAddress(string value) => Value = value;

    public string Value { get; }

    public static bool TryCreate(string? input, [NotNullWhen(true)] out EmailAddress? email)
    {
        email = null;
        if (string.IsNullOrWhiteSpace(input) || input.Length > 254)
        {
            return false;
        }

        var trimmed = input.Trim();
        if (!MailAddress.TryCreate(trimmed, out var parsed) || parsed.Address != trimmed || !parsed.Host.Contains('.', StringComparison.Ordinal))
        {
            return false;
        }

        email = new EmailAddress(trimmed.ToUpperInvariant());
        return true;
    }
}
