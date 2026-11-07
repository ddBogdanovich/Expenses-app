using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using PocketLedger.UseCases.Authentication.Preview;
using PocketLedger.UseCases.Common;

namespace PocketLedger.Infrastructure.Expenses;

internal sealed class CurrentAccount(IHttpContextAccessor accessor) : ICurrentAccount
{
    public Guid? AccountId
    {
        get
        {
            var user = accessor.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true)
            {
                return null;
            }

            if (user.Identity.AuthenticationType != PreviewAuthentication.CookieScheme)
            {
                return null;
            }

            const string claim = PreviewAuthentication.LocalAccountClaim;
            return Guid.TryParse(user.FindFirstValue(claim), out var id) && id != Guid.Empty ? id : null;
        }
    }
}
