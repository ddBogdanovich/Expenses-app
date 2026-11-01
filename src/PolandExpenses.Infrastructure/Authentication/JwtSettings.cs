namespace PolandExpenses.Infrastructure.Authentication;

public sealed class JwtSettings
{
    /// <summary>The minimum key material accepted for HS256 signing.</summary>
    public const int MinimumSigningKeyBytes = 32;

    /// <summary>The fixed access-token validity period for this milestone.</summary>
    public static TimeSpan AccessTokenLifetime => TimeSpan.FromMinutes(30);

    public string Issuer { get; set; } = "PolandExpenses";

    public string Audience { get; set; } = "PolandExpenses.Web";

    public string SigningKey { get; set; } = string.Empty;
}
