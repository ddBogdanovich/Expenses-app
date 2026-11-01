using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PolandExpenses.Domain.Accounts;
using PolandExpenses.UseCases.Authentication.Common;

namespace PolandExpenses.Infrastructure.Authentication;

internal sealed class JwtTokenIssuer(IOptions<JwtSettings> settings, TimeProvider clock) : IAccessTokenIssuer
{
    public string Issue(UserAccount account)
    {
        ArgumentNullException.ThrowIfNull(account);
        var options = settings.Value;
        var now = clock.GetUtcNow().UtcDateTime;
        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: [new Claim("sub", account.Id.ToString()), new Claim("jti", Guid.NewGuid().ToString())],
            notBefore: now,
            expires: now.Add(JwtSettings.AccessTokenLifetime),
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey)), SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
