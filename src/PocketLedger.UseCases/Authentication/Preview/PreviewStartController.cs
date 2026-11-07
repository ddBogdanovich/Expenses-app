using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace PocketLedger.UseCases.Authentication.Preview;

/// <summary>Starts the explicitly selected browser redirect flow.</summary>
[ApiController]
[Route("api/auth/preview/start")]
public sealed class PreviewStartController(IPreviewAvailability availability) : ControllerBase
{
    [HttpGet]
    public IActionResult Start([FromQuery(Name = "returnUrl")] string? destination = null)
    {
        if (!availability.Enabled)
        {
            return NotFound();
        }

        // Exact application destinations only; never accept arbitrary local paths or nested queries.
        destination ??= PreviewAuthentication.LandingPath;
        if (destination is not (PreviewAuthentication.LandingPath or "/" or "/design-system"))
        {
            return BadRequest(new { code = "auth.invalid_return", title = "The return destination is not approved." });
        }

        return Challenge(new AuthenticationProperties { RedirectUri = destination }, PreviewAuthentication.OidcScheme);
    }
}
