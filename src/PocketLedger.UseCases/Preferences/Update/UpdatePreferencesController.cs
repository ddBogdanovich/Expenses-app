using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Preferences.Update;

/// <summary>Authenticated HTTP adapter for account-owned settings.</summary>
[ApiController]
[Authorize]
[Route("api/preferences")]
public sealed class UpdatePreferencesController(UpdatePreferencesHandler handler) : ControllerBase
{
    [HttpPatch]
    public async Task<IActionResult> HandleAsync([FromBody] UpdatePreferencesRequest request, CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(request, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => Ok(response));
    }
}
