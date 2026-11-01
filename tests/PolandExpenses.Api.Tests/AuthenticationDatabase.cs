using System.Diagnostics.CodeAnalysis;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.PostgreSql;

namespace PolandExpenses.Api.Tests;

/// <summary>Owns an isolated real PostgreSQL database for HTTP authentication scenarios.</summary>
[SuppressMessage("Maintainability", "CA1515:Consider making public types internal", Justification = "xUnit v2 constructs this public class fixture through its public test-class constructor.")]
public sealed class AuthenticationDatabase : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17-alpine")
        .Build();

    internal string SigningKey { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

    public Task InitializeAsync() => _postgres.StartAsync();

    public Task DisposeAsync() => _postgres.DisposeAsync().AsTask();

    internal WebApplicationFactory<Program> CreateApplication() => new AuthenticationApplication(_postgres.GetConnectionString(), SigningKey);

    private sealed class AuthenticationApplication(string connectionString, string signingKey) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            ArgumentNullException.ThrowIfNull(builder);
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:expenses", connectionString);
            builder.UseSetting("Jwt:SigningKey", signingKey);
        }
    }
}
