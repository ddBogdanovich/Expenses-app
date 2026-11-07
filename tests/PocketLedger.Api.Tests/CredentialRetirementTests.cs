using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using PocketLedger.Domain.Accounts;
using PocketLedger.Infrastructure.Persistence;

namespace PocketLedger.Api.Tests;

public sealed class CredentialRetirementTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    [Theory]
    [InlineData("/api/auth/register")]
    [InlineData("/api/auth/login")]
    public async Task FormerCredentialEndpointsCannotIssueTokensAsync(string route)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        using var response = await client.PostAsJsonAsync(route, new
        {
            email = $"retired-{Guid.NewGuid():N}@example.com",
            password = "A sufficiently long test password"
        });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.DoesNotContain("accessToken", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("valid-former-token")]
    [InlineData("expired")]
    [InlineData("wrong-key")]
    [InlineData("wrong-issuer")]
    [InlineData("wrong-audience")]
    public async Task ProtectedEndpointRejectsAllFormerTokensAsync(string scenario)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        if (scenario != "missing")
        {
            var now = DateTime.UtcNow;
            var token = new JwtSecurityToken(
                issuer: scenario == "wrong-issuer" ? "other" : "PocketLedger",
                audience: scenario == "wrong-audience" ? "other" : "PocketLedger.Web",
                claims: [new Claim("sub", Guid.NewGuid().ToString())],
                notBefore: now.AddHours(-1),
                expires: scenario == "expired" ? now.AddMinutes(-1) : now.AddMinutes(5),
                signingCredentials: new SigningCredentials(
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(scenario == "wrong-key" ? new string('x', 64) : database.SigningKey)),
                    SecurityAlgorithms.HmacSha256));
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
        }

        using var response = await client.GetAsync(new Uri("/api/auth/me", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task StartupDoesNotRequireFormerSigningKeyAsync()
    {
        using var application = database.CreateApplication(builder => builder.UseSetting("Jwt:SigningKey", ""));
        using var client = application.CreateClient();
        using var response = await client.GetAsync(new Uri("/api/auth/me", UriKind.Relative));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CurrentModelAndDatabaseHaveNoPasswordVerifierAsync()
    {
        using var application = database.CreateApplication();
        using var scope = application.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ExpensesDbContext>();
        Assert.Null(context.Model.FindEntityType(typeof(UserAccount))!.FindProperty("PasswordHash"));
        var verifierColumns = await context.Database.SqlQuery<int>(
            $"SELECT count(*)::int AS \"Value\" FROM information_schema.columns WHERE table_name = 'UserAccounts' AND column_name = 'PasswordHash'").SingleAsync();
        Assert.Equal(0, verifierColumns);
    }
}
