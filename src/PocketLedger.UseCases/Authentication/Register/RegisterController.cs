using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using PocketLedger.UseCases.Authentication.Common;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Authentication.Register;

/// <summary>Adapts HTTP register requests to the feature handler.</summary>
[ApiController]
[Route("api/auth/register")]
[AllowAnonymous]
public sealed class RegisterController(RegisterHandler handler) : ControllerBase
{
    private readonly RegisterHandler _handler = handler ?? throw new ArgumentNullException(nameof(handler));

    /// <summary>Executes the credential flow and maps its expected outcome to HTTP.</summary>
    /// <param name="request">The supplied email and password.</param>
    /// <param name="cancellationToken">Cancels the request's asynchronous work.</param>
    /// <returns>The token response or an expected business error.</returns>
    [HttpPost]
    public async Task<IActionResult> RegisterAsync([FromBody] CredentialsRequest request, CancellationToken cancellationToken)
    {
        var result = await _handler.HandleAsync(request, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => StatusCode(StatusCodes.Status201Created, response));
    }
}
