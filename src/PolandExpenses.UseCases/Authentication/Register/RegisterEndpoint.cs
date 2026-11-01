using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PolandExpenses.UseCases.Authentication.Common;
using PolandExpenses.UseCases.Common;

namespace PolandExpenses.UseCases.Authentication.Register;

public sealed class RegisterEndpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);
        endpoints.MapPost("/auth/register", async (CredentialsRequest request, RegisterHandler handler, CancellationToken cancellationToken) =>
        {
            var result = await handler.HandleAsync(request, cancellationToken).ConfigureAwait(false);
            return result.ToHttpResult(response => Results.Json(response, statusCode: StatusCodes.Status201Created));
        }).AllowAnonymous();
    }
}
