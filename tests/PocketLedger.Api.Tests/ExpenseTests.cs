using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.UseCases.Expenses.Common;

namespace PocketLedger.Api.Tests;

/// <summary>
/// Tests-first contract: Expense is an independently persisted aggregate owned by the token subject.
/// POST /api/expenses returns 201 with Location and the expense; GET collection returns a JSON array;
/// GET/PUT /api/expenses/{id} return the expense; DELETE returns 204. Missing or foreign IDs return 404.
/// Amounts are integer PLN grosz, purchaseDate is a Warsaw calendar date, category is free text,
/// note is optional, and qualifiesForAllowance is explicit. Ownership is never supplied by the caller.
/// </summary>
public sealed class ExpenseTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    [Fact]
    public async Task OwnerCanCreateReadUpdateAndDeleteExpenseAsync()
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        await AuthenticateAsync(client).ConfigureAwait(true);
        using var created = await client.PostAsJsonAsync("/api/expenses", Expense()).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var original = await ReadAsync(created).ConfigureAwait(true);
        var id = original.GetProperty("id").GetGuid();
        Assert.NotEqual(Guid.Empty, id);
        AssertExpense(original, 3500, "Food", "Lunch", true);
        Assert.NotNull(created.Headers.Location);
        Assert.EndsWith($"/api/expenses/{id}", created.Headers.Location.OriginalString, StringComparison.Ordinal);

        using var read = await client.GetAsync(created.Headers.Location).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        AssertExpense(await ReadAsync(read).ConfigureAwait(true), 3500, "Food", "Lunch", true);
        using var list = await client.GetAsync(new Uri("/api/expenses", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal(id, Assert.Single((await ReadAsync(list).ConfigureAwait(true)).EnumerateArray()).GetProperty("id").GetGuid());

        using var updated = await client.PutAsJsonAsync($"/api/expenses/{id}", Expense(1, "Transport", null, false)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var changed = await ReadAsync(updated).ConfigureAwait(true);
        Assert.Equal(id, changed.GetProperty("id").GetGuid());
        AssertExpense(changed, 1, "Transport", null, false);
        using var reread = await client.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, reread.StatusCode);
        AssertExpense(await ReadAsync(reread).ConfigureAwait(true), 1, "Transport", null, false);

        using var deleted = await client.DeleteAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using var missing = await client.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        using var empty = await client.GetAsync(new Uri("/api/expenses", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, empty.StatusCode);
        Assert.Empty((await ReadAsync(empty).ConfigureAwait(true)).EnumerateArray());
    }

    [Theory]
    [InlineData("GET", false)]
    [InlineData("GET", true)]
    [InlineData("POST", false)]
    [InlineData("PUT", true)]
    [InlineData("DELETE", true)]
    public async Task EveryOperationRequiresAuthenticationAsync(string method, bool item)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        using var request = new HttpRequestMessage(new HttpMethod(method), item ? $"/api/expenses/{Guid.NewGuid()}" : "/api/expenses");
        if (method is "POST" or "PUT")
        {
            request.Content = JsonContent.Create(Expense());
        }

        using var response = await client.SendAsync(request).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task OtherAccountCannotListReadChangeOrDeleteOwnersExpenseAsync()
    {
        using var application = database.CreateApplication();
        using var owner = application.CreateClient();
        using var stranger = application.CreateClient();
        await AuthenticateAsync(owner).ConfigureAwait(true);
        await AuthenticateAsync(stranger).ConfigureAwait(true);
        var id = await CreateAsync(owner).ConfigureAwait(true);
        using var list = await stranger.GetAsync(new Uri("/api/expenses", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Empty((await ReadAsync(list).ConfigureAwait(true)).EnumerateArray());
        using var read = await stranger.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NotFound, read.StatusCode);
        using var edit = await stranger.PutAsJsonAsync($"/api/expenses/{id}", Expense(999)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NotFound, edit.StatusCode);
        using var delete = await stranger.DeleteAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
        using var preserved = await owner.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, preserved.StatusCode);
        AssertExpense(await ReadAsync(preserved).ConfigureAwait(true), 3500, "Food", "Lunch", true);
    }

    [Fact]
    public async Task CallerCannotAssignExpenseToAnotherAccountAsync()
    {
        using var application = database.CreateApplication();
        using var caller = application.CreateClient();
        using var other = application.CreateClient();
        await AuthenticateAsync(caller).ConfigureAwait(true);
        await AuthenticateAsync(other).ConfigureAwait(true);
        using var identity = await other.GetAsync(new Uri("/api/auth/me", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, identity.StatusCode);
        var otherId = (await ReadAsync(identity).ConfigureAwait(true)).GetProperty("accountId").GetString();
        var payload = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(Expense()))!;
        payload["ownerId"] = JsonSerializer.SerializeToElement(otherId);
        payload["accountId"] = JsonSerializer.SerializeToElement(otherId);
        using var created = await caller.PostAsJsonAsync("/api/expenses", payload).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await ReadAsync(created).ConfigureAwait(true)).GetProperty("id").GetGuid();
        using var updated = await caller.PutAsJsonAsync($"/api/expenses/{id}", payload).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        using var owned = await caller.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, owned.StatusCode);
        using var hidden = await other.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NotFound, hidden.StatusCode);
        using var list = await other.GetAsync(new Uri("/api/expenses", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Empty((await ReadAsync(list).ConfigureAwait(true)).EnumerateArray());
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("PUT")]
    [InlineData("DELETE")]
    public async Task UnknownExpenseReturnsNotFoundAsync(string method)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        await AuthenticateAsync(client).ConfigureAwait(true);
        using var request = new HttpRequestMessage(new HttpMethod(method), $"/api/expenses/{Guid.NewGuid()}");
        if (method == "PUT")
        {
            request.Content = JsonContent.Create(Expense());
        }

        using var response = await client.SendAsync(request).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("amountGrosz", "0")]
    [InlineData("amountGrosz", "-1")]
    [InlineData("amountGrosz", "1.5")]
    [InlineData("amountGrosz", "9223372036854775808")]
    [InlineData("amountGrosz", "null")]
    [InlineData("purchaseDate", "\"2999-01-01\"")]
    [InlineData("purchaseDate", "\"2026-02-30\"")]
    [InlineData("purchaseDate", "null")]
    [InlineData("category", "\"\"")]
    [InlineData("category", "\"   \"")]
    [InlineData("category", "null")]
    public async Task InvalidCreateAndUpdateLeaveStoredExpensesUnchangedAsync(string field, string json)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        await AuthenticateAsync(client).ConfigureAwait(true);
        var id = await CreateAsync(client).ConfigureAwait(true);
        var payload = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(Expense()))!;
        payload[field] = JsonSerializer.Deserialize<JsonElement>(json);
        using var create = await client.PostAsJsonAsync("/api/expenses", payload).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        using var update = await client.PutAsJsonAsync($"/api/expenses/{id}", payload).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
        using var read = await client.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        AssertExpense(await ReadAsync(read).ConfigureAwait(true), 3500, "Food", "Lunch", true);
        using var list = await client.GetAsync(new Uri("/api/expenses", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Single((await ReadAsync(list).ConfigureAwait(true)).EnumerateArray());
    }

    [Theory]
    [InlineData("amountGrosz")]
    [InlineData("purchaseDate")]
    [InlineData("category")]
    [InlineData("qualifiesForAllowance")]
    public async Task RequiredFieldsCannotBeOmittedAsync(string field)
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        await AuthenticateAsync(client).ConfigureAwait(true);
        var id = await CreateAsync(client).ConfigureAwait(true);
        var payload = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(Expense()))!;
        Assert.True(payload.Remove(field));
        using var create = await client.PostAsJsonAsync("/api/expenses", payload).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        using var update = await client.PutAsJsonAsync($"/api/expenses/{id}", payload).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
        using var read = await client.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        AssertExpense(await ReadAsync(read).ConfigureAwait(true), 3500, "Food", "Lunch", true);
    }

    [Fact]
    public async Task OwnerCanBackdatePurchaseAcrossYearBoundaryAsync()
    {
        using var application = database.CreateApplication();
        using var client = application.CreateClient();
        await AuthenticateAsync(client).ConfigureAwait(true);
        var id = await CreateAsync(client).ConfigureAwait(true);
        var payload = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(Expense()))!;
        payload["purchaseDate"] = JsonSerializer.SerializeToElement("2025-12-31");
        using var update = await client.PutAsJsonAsync($"/api/expenses/{id}", payload).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Equal("2025-12-31", (await ReadAsync(update).ConfigureAwait(true)).GetProperty("purchaseDate").GetString());
        using var read = await client.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        var expense = await ReadAsync(read).ConfigureAwait(true);
        Assert.Equal("2025-12-31", expense.GetProperty("purchaseDate").GetString());
        Assert.Equal(id, expense.GetProperty("id").GetGuid());
        Assert.Equal(3500, expense.GetProperty("amountGrosz").GetInt64());
    }

    [Fact]
    public async Task ExpenseSurvivesApiRestartAsync()
    {
        Guid id;
        string token;
        using (var first = database.CreateApplication())
        using (var client = first.CreateClient())
        {
            token = await AuthenticateAsync(client).ConfigureAwait(true);
            id = await CreateAsync(client).ConfigureAwait(true);
        }

        using var restarted = database.CreateApplication();
        using var reader = restarted.CreateClient();
        reader.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await reader.GetAsync(new Uri($"/api/expenses/{id}", UriKind.Relative)).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertExpense(await ReadAsync(response).ConfigureAwait(true), 3500, "Food", "Lunch", true);
    }

    [Theory]
    [InlineData("2026-01-01T22:30:00Z", "2026-01-01")]
    [InlineData("2026-01-01T23:30:00Z", "2026-01-02")]
    [InlineData("2026-03-29T22:30:00Z", "2026-03-30")]
    [InlineData("2026-10-25T22:30:00Z", "2026-10-25")]
    public void BusinessCalendarUsesWarsawDateIncludingDaylightSaving(string utcInstant, string expectedDate)
    {
        var instant = DateTimeOffset.Parse(utcInstant, CultureInfo.InvariantCulture);
        using var application = database.CreateApplication();
        using var configured = application.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.AddSingleton<TimeProvider>(new FrozenTimeProvider(instant))));
        var calendar = configured.Services.GetRequiredService<IBusinessCalendar>();

        Assert.Equal(DateOnly.Parse(expectedDate, CultureInfo.InvariantCulture), calendar.Today);
    }

    private sealed class FrozenTimeProvider(DateTimeOffset instant) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => instant;
    }

    private static object Expense(long amountGrosz = 3500, string category = "Food", string? note = "Lunch", bool qualifies = true) =>
        new { amountGrosz, purchaseDate = "2026-01-01", category, note, qualifiesForAllowance = qualifies };

    private static async Task<string> AuthenticateAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"expense-{Guid.NewGuid():N}@example.com",
            password = "Study-project!42",
        }).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var token = (await ReadAsync(response).ConfigureAwait(true)).GetProperty("accessToken").GetString()!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return token;
    }

    private static async Task<Guid> CreateAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync("/api/expenses", Expense()).ConfigureAwait(true);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await ReadAsync(response).ConfigureAwait(true)).GetProperty("id").GetGuid();
    }

    private static Task<JsonElement> ReadAsync(HttpResponseMessage response) => response.Content.ReadFromJsonAsync<JsonElement>();

    private static void AssertExpense(JsonElement expense, long amount, string category, string? note, bool qualifies)
    {
        Assert.Equal(amount, expense.GetProperty("amountGrosz").GetInt64());
        Assert.Equal("2026-01-01", expense.GetProperty("purchaseDate").GetString());
        Assert.Equal(category, expense.GetProperty("category").GetString());
        Assert.Equal(note, expense.GetProperty("note").GetString());
        Assert.Equal(qualifies, expense.GetProperty("qualifiesForAllowance").GetBoolean());
    }
}
