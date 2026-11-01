using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PolandExpenses.UseCases.Authentication.Common;
using PolandExpenses.UseCases.Common;

namespace PolandExpenses.UseCases.Authentication.Login;

/// <summary>Adapts HTTP login requests to the feature handler.</summary>
[ApiController]
[Route("api/auth/login")]
[AllowAnonymous]
public sealed class LoginController(LoginHandler handler) : ControllerBase
{
    private readonly LoginHandler _handler = handler ?? throw new ArgumentNullException(nameof(handler));

    /// <summary>Executes the credential flow and maps its expected outcome to HTTP.</summary>
    /// <param name="request">The supplied email and password.</param>
    /// <param name="cancellationToken">Cancels the request's asynchronous work.</param>
    /// <returns>The token response or an expected business error.</returns>
    [HttpPost]
    public async Task<IActionResult> LoginAsync([FromBody] CredentialsRequest request, CancellationToken cancellationToken)
    {
        var result = await _handler.HandleAsync(request, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => Ok(response));
    }
}
