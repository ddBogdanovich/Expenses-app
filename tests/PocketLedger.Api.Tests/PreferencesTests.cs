using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.Domain.Preferences;
using PocketLedger.Infrastructure.Persistence;
using PocketLedger.UseCases.Preferences.Common;

namespace PocketLedger.Api.Tests;

/// <summary>Account-owned settings through authenticated HTTP and disposable PostgreSQL.</summary>
public sealed class PreferencesTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    [Fact]
    public async Task DefaultsZonePersistenceIsolationAndInvalidWritesPreserveHistoryAsync()
    {
        using var app = database.CreateApplication();
        using var owner = app.CreateClient();
        using var other = app.CreateClient();
        await SignInAsync(owner);
        await SignInAsync(other);
        var initial = await owner.GetFromJsonAsync<JsonElement>("/api/preferences");
        Assert.Equal("Europe/Warsaw", initial.GetProperty("timeZone").GetString());
        Assert.Equal("PLN", initial.GetProperty("defaultCurrency").GetString());
        Assert.Empty(initial.GetProperty("recentCurrencies").EnumerateArray());
        using var purchase = await owner.PostAsJsonAsync("/api/expenses", new
        {
            amountGrosz = 1234,
            purchaseDate = "2026-01-01",
            category = "Food",
            note = "Keep exactly",
            qualifiesForAllowance = false,
        });
        Assert.Equal(HttpStatusCode.Created, purchase.StatusCode);
        var before = await owner.GetStringAsync(new Uri("/api/expenses", UriKind.Relative));
        using var saved = await owner.PatchAsJsonAsync("/api/preferences", new { timeZone = "America/Los_Angeles", expectedRevision = initial.GetProperty("revision").GetString() });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var current = await saved.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("America/Los_Angeles", current.GetProperty("timeZone").GetString());
        Assert.NotEqual(initial.GetProperty("revision").GetString(), current.GetProperty("revision").GetString());
        Assert.Equal(before, await owner.GetStringAsync(new Uri("/api/expenses", UriKind.Relative)));
        Assert.Equal("Europe/Warsaw", (await other.GetFromJsonAsync<JsonElement>("/api/preferences")).GetProperty("timeZone").GetString());
        using var stale = await owner.PatchAsJsonAsync("/api/preferences", new { timeZone = "Europe/Warsaw", expectedRevision = initial.GetProperty("revision").GetString() });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        foreach (var zone in new[] { "Invalid/Zone", "Pacific Standard Time", "+02:00", "" })
        {
            using var invalid = await owner.PatchAsJsonAsync("/api/preferences", new { timeZone = zone, expectedRevision = current.GetProperty("revision").GetString() });
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        }
        owner.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        using var forged = await owner.PatchAsJsonAsync("/api/preferences", new { timeZone = "Europe/Warsaw", expectedRevision = current.GetProperty("revision").GetString() });
        Assert.Equal(HttpStatusCode.BadRequest, forged.StatusCode);
        Assert.Equal(current.GetRawText(), (await owner.GetFromJsonAsync<JsonElement>("/api/preferences")).GetRawText());
        Assert.Equal(before, await owner.GetStringAsync(new Uri("/api/expenses", UriKind.Relative)));
    }

    [Theory]
    [InlineData("/api/preferences")]
    [InlineData("/api/preferences/time-zones")]
    public async Task AnonymousCannotReadAndResponsesAreNotStoredAsync(string path)
    {
        using var app = database.CreateApplication();
        using var client = app.CreateClient();
        using var response = await client.GetAsync(new Uri(path, UriKind.Relative));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    [Fact]
    public async Task OppositeDateBoundariesAndUnchangedFutureDateCorrectionsUseOnlySavedZoneAsync()
    {
        using var app = database.CreateApplication(builder => builder.ConfigureServices(services =>
            services.AddSingleton<IBusinessClock>(new FixedClock(DateTimeOffset.Parse("2026-11-08T00:30:00Z", CultureInfo.InvariantCulture)))));
        using var owner = app.CreateClient();
        using var other = app.CreateClient();
        await SignInAsync(owner);
        await SignInAsync(other);
        var saved = await owner.GetFromJsonAsync<JsonElement>("/api/preferences");
        using var east = await owner.PatchAsJsonAsync("/api/preferences", new { timeZone = "Pacific/Kiritimati", expectedRevision = saved.GetProperty("revision").GetString() });
        Assert.Equal(HttpStatusCode.OK, east.StatusCode);
        var eastContext = await east.Content.ReadFromJsonAsync<JsonElement>();
        var payload = new { amountGrosz = 1234, purchaseDate = "2026-11-08", category = "Food", note = "Original", qualifiesForAllowance = true };
        using var created = await owner.PostAsJsonAsync("/api/expenses", payload);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var expense = await created.Content.ReadFromJsonAsync<JsonElement>();
        var before = await owner.GetStringAsync(new Uri("/api/expenses", UriKind.Relative));
        using var west = await owner.PatchAsJsonAsync("/api/preferences", new { timeZone = "America/Los_Angeles", expectedRevision = eastContext.GetProperty("revision").GetString() });
        Assert.Equal(HttpStatusCode.OK, west.StatusCode);
        Assert.Equal(before, await owner.GetStringAsync(new Uri("/api/expenses", UriKind.Relative)));
        var local = await owner.GetFromJsonAsync<JsonElement>("/api/expenses/today");
        var warsaw = await other.GetFromJsonAsync<JsonElement>("/api/expenses/today");
        Assert.Equal("2026-11-07", local.GetProperty("purchaseDate").GetString());
        Assert.Equal("2026-11-08", warsaw.GetProperty("purchaseDate").GetString());
        Assert.False(local.GetProperty("hasExpenses").GetBoolean());
        using var future = await owner.PostAsJsonAsync("/api/expenses", payload);
        Assert.Equal(HttpStatusCode.BadRequest, future.StatusCode);
        var route = $"/api/expenses/{expense.GetProperty("id").GetGuid()}";
        using var corrected = await owner.PutAsJsonAsync(route, new { payload.amountGrosz, payload.purchaseDate, category = "Transport", note = "Correction", qualifiesForAllowance = false });
        Assert.Equal(HttpStatusCode.OK, corrected.StatusCode);
        using var changedFutureDate = await owner.PutAsJsonAsync(route, new { payload.amountGrosz, purchaseDate = "2026-11-09", payload.category, payload.note, payload.qualifiesForAllowance });
        Assert.Equal(HttpStatusCode.BadRequest, changedFutureDate.StatusCode);
        using var removed = await owner.DeleteAsync(new Uri(route, UriKind.Relative));
        Assert.Equal(HttpStatusCode.NoContent, removed.StatusCode);
    }

    [Theory]
    [InlineData("2026-03-28T23:30:00Z", "2026-03-29")]
    [InlineData("2026-03-29T01:30:00Z", "2026-03-29")]
    [InlineData("2026-03-29T22:30:00Z", "2026-03-30")]
    [InlineData("2026-10-25T00:30:00Z", "2026-10-25")]
    [InlineData("2026-10-25T01:30:00Z", "2026-10-25")]
    [InlineData("2026-10-25T23:30:00Z", "2026-10-26")]
    public async Task BusinessClockControlsDstWithoutExpiringAuthenticationAsync(string instant, string date)
    {
        using var app = database.CreateApplication(builder => builder.ConfigureServices(services =>
            services.AddSingleton<IBusinessClock>(new FixedClock(DateTimeOffset.Parse(instant, CultureInfo.InvariantCulture)))));
        using var client = app.CreateClient();
        await SignInAsync(client);
        var summary = await client.GetFromJsonAsync<JsonElement>("/api/expenses/today");
        Assert.Equal(date, summary.GetProperty("purchaseDate").GetString());
        Assert.Equal("Europe/Warsaw", summary.GetProperty("timeZone").GetString());
    }

    [Fact]
    public async Task CatalogueIsRegionalAndEveryListedZoneResolvesAsync()
    {
        using var app = database.CreateApplication();
        using var client = app.CreateClient();
        await SignInAsync(client);
        var zones = await client.GetFromJsonAsync<string[]>("/api/preferences/time-zones");
        Assert.NotNull(zones);
        Assert.Contains("Europe/Warsaw", zones);
        Assert.Contains("Pacific/Kiritimati", zones);
        Assert.Contains("America/Los_Angeles", zones);
        Assert.Equal(zones.Distinct(StringComparer.Ordinal).Count(), zones.Length);
        foreach (var zone in zones)
        {
            Assert.True(TimeZoneInfo.FindSystemTimeZoneById(zone).HasIanaId);
            Assert.Contains("/", zone, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task ConcurrentPreferenceWritersHaveOneWinnerAndOneConflictAsync()
    {
        using var app = database.CreateApplication();
        using var client = app.CreateClient();
        await SignInAsync(client);
        var identity = await client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        var ownerId = identity.GetProperty("accountId").GetGuid();
        using var firstScope = app.Services.CreateScope();
        using var secondScope = app.Services.CreateScope();
        var first = firstScope.ServiceProvider.GetRequiredService<IAccountPreferencesRepository>();
        var second = secondScope.ServiceProvider.GetRequiredService<IAccountPreferencesRepository>();
        var left = await first.FindAsync(ownerId, CancellationToken.None);
        var right = await second.FindAsync(ownerId, CancellationToken.None);
        Assert.NotNull(left);
        Assert.NotNull(right);
        Assert.Equal(left.Revision, right.Revision);
        left.ChangeTimeZone("Pacific/Kiritimati");
        right.ChangeTimeZone("America/Los_Angeles");
        var outcomes = await Task.WhenAll(first.SaveAsync(left, CancellationToken.None), second.SaveAsync(right, CancellationToken.None));
        Assert.Single(outcomes, value => value);
        var final = await client.GetFromJsonAsync<JsonElement>("/api/preferences");
        Assert.Equal(outcomes[0] ? left.TimeZone : right.TimeZone, final.GetProperty("timeZone").GetString());
        Assert.Equal("1", final.GetProperty("revision").GetString());
        Assert.Equal("PLN", final.GetProperty("defaultCurrency").GetString());
        Assert.Empty(final.GetProperty("recentCurrencies").EnumerateArray());
    }

    [Fact]
    public async Task UnavailableStoredZoneIsRetainedAndCanBeExplicitlyRepairedAsync()
    {
        using var app = database.CreateApplication();
        using var client = app.CreateClient();
        await SignInAsync(client);
        var identity = await client.GetFromJsonAsync<JsonElement>("/api/auth/me");
        var ownerId = identity.GetProperty("accountId").GetGuid();
        using (var scope = app.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ExpensesDbContext>();
            await context.Database.ExecuteSqlInterpolatedAsync($"UPDATE \"AccountPreferences\" SET \"TimeZone\" = {"Unavailable/Zone"} WHERE \"OwnerId\" = {ownerId}");
        }

        var saved = await client.GetFromJsonAsync<JsonElement>("/api/preferences");
        Assert.Equal("Unavailable/Zone", saved.GetProperty("timeZone").GetString());
        Assert.Equal(JsonValueKind.Null, saved.GetProperty("purchaseDate").ValueKind);
        using var summary = await client.GetAsync(new Uri("/api/expenses/today", UriKind.Relative));
        Assert.Equal(HttpStatusCode.Conflict, summary.StatusCode);
        Assert.Equal("preferences.unavailable_zone", (await summary.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
        using var repaired = await client.PatchAsJsonAsync("/api/preferences", new { timeZone = "Europe/Warsaw", expectedRevision = saved.GetProperty("revision").GetString() });
        Assert.Equal(HttpStatusCode.OK, repaired.StatusCode);
        using var restored = await client.GetAsync(new Uri("/api/expenses/today", UriKind.Relative));
        Assert.Equal(HttpStatusCode.OK, restored.StatusCode);
    }

    private sealed record FixedClock(DateTimeOffset UtcNow) : IBusinessClock;

    private static async Task SignInAsync(HttpClient client)
    {
        using var session = await client.GetAsync(new Uri("/test/expense-session", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, session.StatusCode);
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/preview/antiforgery").ConfigureAwait(true);
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("requestToken").GetString());
    }
}
