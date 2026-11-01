using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace PolandExpenses.Api.Tests;

/// <summary>Specifies authentication behavior through the real API HTTP pipeline.</summary>
public sealed class AuthenticationTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    private const string Password = "Study-project!42";

    [Fact]
    public async Task RegistrationReturnsJwtAsync()
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();

        using var response = await client.PostAsJsonAsync("/auth/register", Credentials(NewEmail())).ConfigureAwait(true);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await AssertJwtAsync(response).ConfigureAwait(true);
    }

    [Fact]
    public async Task RegisteredUserCanLogInWithANewClientAsync()
    {
        using var application = database.CreateApplication();
        using var registrationClient = application.CreateClient();
        var credentials = Credentials(NewEmail());
        using var registration = await registrationClient.PostAsJsonAsync("/auth/register", credentials).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        using var loginClient = application.CreateClient();

        using var login = await loginClient.PostAsJsonAsync("/auth/login", credentials).ConfigureAwait(true);

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        await AssertJwtAsync(login).ConfigureAwait(true);
    }

    [Fact]
    public async Task UnknownUserLoginFailsWithoutCreatingAnAccountAsync()
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        var credentials = Credentials(NewEmail());

        using var login = await client.PostAsJsonAsync("/auth/login", credentials).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        await AssertNoTokenAsync(login).ConfigureAwait(true);
        using var registration = await client.PostAsJsonAsync("/auth/register", credentials).ConfigureAwait(true);

        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        await AssertJwtAsync(registration).ConfigureAwait(true);
    }

    [Fact]
    public async Task WrongPasswordDoesNotAuthenticateOrChangeExistingPasswordAsync()
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        var email = NewEmail();
        using var registration = await client.PostAsJsonAsync("/auth/register", Credentials(email)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);

        using var rejected = await client.PostAsJsonAsync("/auth/login", new { email, password = "Wrong-password!42" }).ConfigureAwait(true);

        Assert.Equal(HttpStatusCode.Unauthorized, rejected.StatusCode);
        await AssertNoTokenAsync(rejected).ConfigureAwait(true);
        using var accepted = await client.PostAsJsonAsync("/auth/login", Credentials(email)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        await AssertJwtAsync(accepted).ConfigureAwait(true);
    }

    [Fact]
    public async Task DuplicateRegistrationDoesNotReplaceExistingCredentialsAsync()
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        var email = NewEmail();
        using var first = await client.PostAsJsonAsync("/auth/register", Credentials(email)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        using var duplicate = await client.PostAsJsonAsync("/auth/register", new { email, password = "Replacement!42" }).ConfigureAwait(true);

        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        await AssertNoTokenAsync(duplicate).ConfigureAwait(true);
        using var login = await client.PostAsJsonAsync("/auth/login", Credentials(email)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        await AssertJwtAsync(login).ConfigureAwait(true);
    }

    [Theory]
    [InlineData("/auth/register", "not-an-email", Password)]
    [InlineData("/auth/register", "", Password)]
    [InlineData("/auth/register", null, Password)]
    [InlineData("/auth/register", "valid@example.com", "")]
    [InlineData("/auth/register", "valid@example.com", null)]
    [InlineData("/auth/login", "not-an-email", Password)]
    [InlineData("/auth/login", "", Password)]
    [InlineData("/auth/login", null, Password)]
    [InlineData("/auth/login", "valid@example.com", "")]
    [InlineData("/auth/login", "valid@example.com", null)]
    public async Task InvalidCredentialsAreRejectedAsync(string route, string? email, string? password)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();

        using var response = await client.PostAsJsonAsync(route, new { email, password }).ConfigureAwait(true);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertNoTokenAsync(response).ConfigureAwait(true);
    }

    [Fact]
    public async Task AccountSurvivesApiRestartAsync()
    {
        var credentials = Credentials(NewEmail());
        string registeredToken;
        using (var firstHost = database.CreateApplication())
        using (var client = firstHost.CreateClient())
        {
            using var registration = await client.PostAsJsonAsync("/auth/register", credentials).ConfigureAwait(true);
            Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
            registeredToken = await ReadTokenAsync(registration).ConfigureAwait(true);
        }

        using var secondHost = database.CreateApplication();
        using var loginClient = secondHost.CreateClient();
        using var login = await loginClient.PostAsJsonAsync("/auth/login", credentials).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var loginToken = await ReadTokenAsync(login).ConfigureAwait(true);
        var reader = new JwtSecurityTokenHandler();
        Assert.Equal(reader.ReadJwtToken(registeredToken).Subject, reader.ReadJwtToken(loginToken).Subject);
        loginClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginToken);
        using var identity = await loginClient.GetAsync(new Uri("/auth/me", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, identity.StatusCode);
        var body = await identity.Content.ReadFromJsonAsync<JsonElement>().ConfigureAwait(true);
        Assert.Equal(reader.ReadJwtToken(loginToken).Subject, body.GetProperty("accountId").GetString());
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("expired")]
    [InlineData("wrong-key")]
    [InlineData("wrong-issuer")]
    [InlineData("wrong-audience")]
    public async Task ProtectedEndpointRejectsInvalidTokensAsync(string scenario)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        if (scenario != "missing")
        {
            var now = DateTime.UtcNow;
            var token = new JwtSecurityToken(
                issuer: scenario == "wrong-issuer" ? "other" : "PolandExpenses",
                audience: scenario == "wrong-audience" ? "other" : "PolandExpenses.Web",
                claims: [new Claim("sub", Guid.NewGuid().ToString())],
                notBefore: now.AddHours(-1),
                expires: scenario == "expired" ? now.AddMinutes(-1) : now.AddMinutes(5),
                signingCredentials: new SigningCredentials(
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(scenario == "wrong-key" ? new string('x', 64) : database.SigningKey)),
                    SecurityAlgorithms.HmacSha256));
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
        }

        using var response = await client.GetAsync(new Uri("/auth/me", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ConcurrentCaseInsensitiveRegistrationsCreateOneAccountAsync()
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        var email = NewEmail();
        var responses = await Task.WhenAll(
            client.PostAsJsonAsync("/auth/register", Credentials(email)),
            client.PostAsJsonAsync("/auth/register", Credentials(email.ToUpperInvariant()))).ConfigureAwait(true);
        try
        {
            Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
            Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }

    [Theory]
    [InlineData(11, HttpStatusCode.BadRequest)]
    [InlineData(12, HttpStatusCode.Created)]
    [InlineData(128, HttpStatusCode.Created)]
    [InlineData(129, HttpStatusCode.BadRequest)]
    public async Task RegistrationEnforcesPasswordLengthBoundariesAsync(int passwordLength, HttpStatusCode expectedStatus)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        using var response = await client.PostAsJsonAsync("/auth/register", new
        {
            email = NewEmail(),
            password = new string('a', passwordLength)
        }).ConfigureAwait(true);

        Assert.Equal(expectedStatus, response.StatusCode);
        if (expectedStatus == HttpStatusCode.Created)
        {
            await AssertJwtAsync(response).ConfigureAwait(true);
        }
        else
        {
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            var error = await response.Content.ReadFromJsonAsync<JsonElement>().ConfigureAwait(true);
            Assert.Equal(passwordLength < 12 ? "auth.weak_password" : "auth.invalid_input", error.GetProperty("code").GetString());
            await AssertNoTokenAsync(response).ConfigureAwait(true);
        }
    }

    [Theory]
    [InlineData("/auth/register")]
    [InlineData("/auth/login")]
    public async Task MalformedJsonIsRejectedByTheControllerPipelineAsync(string route)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        using var content = new StringContent("{", Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(new Uri(route, UriKind.Relative), content).ConfigureAwait(true);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertNoTokenAsync(response).ConfigureAwait(true);
    }

    private static async Task<string> ReadTokenAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>().ConfigureAwait(true);
        return body.GetProperty("accessToken").GetString()!;
    }

    private static string NewEmail() => $"user-{Guid.NewGuid():N}@example.com";

    private static object Credentials(string email) => new { email, password = Password };

    private static async Task AssertJwtAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>().ConfigureAwait(true);
        var token = body.GetProperty("accessToken").GetString();
        Assert.False(string.IsNullOrWhiteSpace(token));
        var parts = token.Split('.');
        Assert.Equal(3, parts.Length);
        Assert.All(parts, part => Assert.NotEmpty(part));
        using var header = DecodeJwtPart(parts[0]);
        Assert.NotEqual("none", header.RootElement.GetProperty("alg").GetString());
        using var payload = DecodeJwtPart(parts[1]);
        Assert.False(string.IsNullOrWhiteSpace(payload.RootElement.GetProperty("sub").GetString()));
        Assert.True(payload.RootElement.GetProperty("exp").GetInt64() > DateTimeOffset.UtcNow.ToUnixTimeSeconds());
    }

    private static JsonDocument DecodeJwtPart(string part)
    {
        var base64 = part.Replace('-', '+').Replace('_', '/');
        base64 = base64.PadRight((base64.Length + 3) / 4 * 4, '=');
        return JsonDocument.Parse(Convert.FromBase64String(base64));
    }

    private static async Task AssertNoTokenAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync().ConfigureAwait(true);
        if (!string.IsNullOrWhiteSpace(body))
        {
            using var json = JsonDocument.Parse(body);
            Assert.False(json.RootElement.TryGetProperty("accessToken", out _));
        }
    }
}
