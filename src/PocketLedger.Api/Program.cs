using Microsoft.EntityFrameworkCore;
using PocketLedger.Infrastructure;
using PocketLedger.Infrastructure.Authentication;
using PocketLedger.Infrastructure.Authentication.Preview;
using PocketLedger.Infrastructure.Persistence;
using PocketLedger.UseCases;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddUseCases();
builder.Services.AddInfrastructure();
builder.Services.AddPostgresPersistence(builder.Configuration.GetConnectionString("expenses")
    ?? throw new InvalidOperationException("The expenses database connection string is required."));
builder.Services.AddAccountAuthentication(builder.Configuration);
builder.Services.AddKeycloakPreview(builder.Configuration, builder.Environment);
if (builder.Configuration.GetValue<bool>("Keycloak:Enabled"))
{
    // OIDC callback queries contain one-use authentication material.
    builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
}

var app = builder.Build();

// Local development and isolated tests apply migrations; deployment applies reviewed migrations separately.
if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing"))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<ExpensesDbContext>().Database.MigrateAsync().ConfigureAwait(false);
}

app.UseAuthentication();
app.UseAuthorization();
app.Use(async (context, next) =>
{
    if (context.Request.Headers.ContainsKey(PocketLedger.UseCases.Authentication.Preview.PreviewAuthentication.SelectorHeader))
    {
        context.Response.Headers.CacheControl = "no-store";
    }

    await next(context).ConfigureAwait(false);
});
app.MapDefaultEndpoints();
app.MapControllers();

await app.RunAsync().ConfigureAwait(false);

/// <summary>Exposes the API entry point to HTTP acceptance tests.</summary>
internal partial class Program
{
    private Program()
    {
    }
}
