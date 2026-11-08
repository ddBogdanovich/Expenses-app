using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Preferences.TimeZones;

/// <summary>Authenticated HTTP adapter for account-owned settings.</summary>
[ApiController]
[Authorize]
[Route("api/preferences")]
public sealed class TimeZonesController(TimeZonesHandler handler) : ControllerBase
{
    [HttpGet("time-zones")]
    public async Task<IActionResult> HandleAsync(CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(TimeZonesRequest.Instance, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => Ok(response));
    }
}
