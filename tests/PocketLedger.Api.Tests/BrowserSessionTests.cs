using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.UseCases.Authentication.Preview;

namespace PocketLedger.Api.Tests;

public sealed class BrowserSessionTests(AuthenticationDatabase database) : IClassFixture<AuthenticationDatabase>
{
    [Fact]
    public async Task RevokedSessionCannotBeResurrectedByAnInFlightRenewalAsync()
    {
        using var application = database.CreateApplication();
        var store = application.Services.GetRequiredService<ITicketStore>();
        var ticket = CreateTicket(DateTimeOffset.UtcNow.AddHours(8));
        var key = await store.StoreAsync(ticket);
        Assert.NotNull(await store.RetrieveAsync(key));
        await store.RemoveAsync(key);
        await store.RenewAsync(key, ticket);
        Assert.Null(await store.RetrieveAsync(key));
    }

    [Fact]
    public async Task SessionCannotOutliveAbsoluteExpirationAsync()
    {
        using var application = database.CreateApplication();
        var store = application.Services.GetRequiredService<ITicketStore>();
        var ticket = CreateTicket(DateTimeOffset.UtcNow.AddMinutes(-1));
        var key = await store.StoreAsync(ticket);
        Assert.Null(await store.RetrieveAsync(key));
    }

    private static AuthenticationTicket CreateTicket(DateTimeOffset absolute)
    {
        var properties = new AuthenticationProperties();
        properties.Items[PreviewAuthentication.AbsoluteExpiryProperty] = absolute.ToString("O", CultureInfo.InvariantCulture);
        return new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(PreviewAuthentication.LocalAccountClaim, Guid.NewGuid().ToString())], PreviewAuthentication.CookieScheme)),
            properties, PreviewAuthentication.CookieScheme);
    }
}
