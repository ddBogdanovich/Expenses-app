using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Preferences.Read;

/// <summary>Authenticated HTTP adapter for account-owned settings.</summary>
[ApiController]
[Authorize]
[Route("api/preferences")]
public sealed class GetPreferencesController(GetPreferencesHandler handler) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> HandleAsync(CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(GetPreferencesRequest.Instance, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => Ok(response));
    }
}
