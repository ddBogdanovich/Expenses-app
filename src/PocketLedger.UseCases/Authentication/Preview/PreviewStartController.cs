using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;

namespace PocketLedger.UseCases.Authentication.Preview;

/// <summary>Starts the explicitly selected browser redirect flow.</summary>
[ApiController]
[Route("api/auth/preview/start")]
public sealed class PreviewStartController(IPreviewAvailability availability) : ControllerBase
{
    [HttpGet]
    public IActionResult Start() => availability.Enabled
        ? Challenge(new AuthenticationProperties { RedirectUri = PreviewAuthentication.LandingPath }, PreviewAuthentication.OidcScheme)
        : NotFound();
}
