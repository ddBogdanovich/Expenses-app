namespace PolandExpenses.Infrastructure.Authentication;

public sealed class JwtSettings
{
    public string Issuer { get; set; } = "PolandExpenses";

    public string Audience { get; set; } = "PolandExpenses.Web";

    public string SigningKey { get; set; } = string.Empty;
}
