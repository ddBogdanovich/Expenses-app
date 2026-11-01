using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PolandExpenses.UseCases.Authentication.Common;
using PolandExpenses.UseCases.Common;

namespace PolandExpenses.UseCases.Authentication.Login;

public sealed class LoginEndpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        endpoints.MapPost("/auth/login", async (CredentialsRequest request, LoginHandler handler, CancellationToken cancellationToken) =>
        {
            var result = await handler.HandleAsync(request, cancellationToken).ConfigureAwait(false);
            return result.ToHttpResult(response => Results.Ok(response));
        }).AllowAnonymous();
    }
}
