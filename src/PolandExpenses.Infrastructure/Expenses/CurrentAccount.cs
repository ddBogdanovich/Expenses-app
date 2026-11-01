using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using PolandExpenses.UseCases.Common;

namespace PolandExpenses.Infrastructure.Expenses;

internal sealed class CurrentAccount(IHttpContextAccessor accessor) : ICurrentAccount
{
    public Guid? AccountId => accessor.HttpContext?.User is { Identity.IsAuthenticated: true } user &&
        Guid.TryParse(user.FindFirstValue("sub"), out var id) && id != Guid.Empty ? id : null;
}
