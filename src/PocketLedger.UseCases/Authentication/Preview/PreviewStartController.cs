using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace PocketLedger.UseCases.Authentication.Preview;

/// <summary>Starts the explicitly selected browser redirect flow.</summary>
[ApiController]
[Route("api/auth/preview/start")]
public sealed class PreviewStartController(IPreviewAvailability availability) : ControllerBase
{
    [HttpGet]
    public IActionResult Start([FromQuery(Name = "returnUrl")] string? destination = null, [FromQuery] string? mode = null)
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

        if (mode is not (null or "login" or "register"))
        {
            return BadRequest(new { code = "auth.invalid_mode", title = "The login mode is not supported." });
        }

        var properties = new AuthenticationProperties { RedirectUri = destination };
        if (mode == "register")
        {
            properties.Items[PreviewAuthentication.RegistrationProperty] = "true";
        }

        return Challenge(properties, PreviewAuthentication.OidcScheme);
    }
}
