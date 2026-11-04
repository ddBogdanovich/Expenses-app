using System.Globalization;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PocketLedger.Infrastructure.Persistence;
using PocketLedger.UseCases.Authentication.Preview;

namespace PocketLedger.Infrastructure.Authentication.Preview;

internal sealed class PostgresTicketStore(IServiceScopeFactory scopes, IDataProtectionProvider protection, TimeProvider clock) : ITicketStore
{
    private const int SessionKeyBytes = 32;
    private readonly IDataProtector _protector = protection.CreateProtector("PocketLedger.Preview.Ticket.v1");

    public async Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var key = Convert.ToHexString(RandomNumberGenerator.GetBytes(SessionKeyBytes));
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ExpensesDbContext>();
        var now = clock.GetUtcNow();
        await context.Set<BrowserSession>().Where(session => session.ExpiresUtc <= now).ExecuteDeleteAsync().ConfigureAwait(false);
        context.Set<BrowserSession>().Add(new BrowserSession
        {
            Id = key,
            ExpiresUtc = BoundExpiry(ticket),
            ProtectedTicket = _protector.Protect(TicketSerializer.Default.Serialize(ticket))
        });
        await context.SaveChangesAsync().ConfigureAwait(false);
        return key;
    }

    public async Task RenewAsync(string key, AuthenticationTicket ticket)
    {
        var expiry = BoundExpiry(ticket);
        var data = _protector.Protect(TicketSerializer.Default.Serialize(ticket));
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ExpensesDbContext>();
        var now = clock.GetUtcNow();
        // Update only: a request finishing after logout must not recreate the deleted session.
        await context.Set<BrowserSession>().Where(session => session.Id == key && session.ExpiresUtc > now)
            .ExecuteUpdateAsync(update => update.SetProperty(session => session.ProtectedTicket, data)
                .SetProperty(session => session.ExpiresUtc, expiry)).ConfigureAwait(false);
    }

    public async Task<AuthenticationTicket?> RetrieveAsync(string key)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ExpensesDbContext>();
        var now = clock.GetUtcNow();
        var session = await context.Set<BrowserSession>().AsNoTracking()
            .SingleOrDefaultAsync(session => session.Id == key && session.ExpiresUtc > now).ConfigureAwait(false);
        if (session is null)
        {
            return null;
        }

        try
        {
            return TicketSerializer.Default.Deserialize(_protector.Unprotect(session.ProtectedTicket));
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    public async Task RemoveAsync(string key)
    {
        using var scope = scopes.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ExpensesDbContext>();
        await context.Set<BrowserSession>().Where(session => session.Id == key).ExecuteDeleteAsync().ConfigureAwait(false);
    }

    private DateTimeOffset BoundExpiry(AuthenticationTicket ticket)
    {
        if (!ticket.Properties.Items.TryGetValue(PreviewAuthentication.AbsoluteExpiryProperty, out var value) ||
            !DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var absolute))
        {
            throw new InvalidOperationException("Preview session must have an absolute expiration.");
        }

        var sliding = clock.GetUtcNow() + PreviewSettings.IdleLifetime;
        var expiry = sliding < absolute ? sliding : absolute;
        ticket.Properties.ExpiresUtc = expiry;
        return expiry;
    }
}
