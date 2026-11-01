using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PolandExpenses.UseCases.Common;

namespace PolandExpenses.UseCases.Authentication.CurrentAccount;

/// <summary>Exposes the validated token subject to the signed-in client.</summary>
public sealed class CurrentAccountEndpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        endpoints.MapGet("/auth/me", (ClaimsPrincipal user) => Results.Ok(new { accountId = user.FindFirstValue("sub") }))
            .RequireAuthorization();
    }
}
