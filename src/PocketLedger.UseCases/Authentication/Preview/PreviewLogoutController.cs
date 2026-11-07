using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace PocketLedger.UseCases.Authentication.Preview;

/// <summary>Ends the local session and navigates to provider sign-out.</summary>
[ApiController]
[Route("api/auth/preview/logout")]
[Authorize(AuthenticationSchemes = PreviewAuthentication.CookieScheme)]
// Keep named cookie authentication so a still-valid ticket is revoked; allow
// an expired browser to reach provider logout after antiforgery validation.
[AllowAnonymous]
public sealed class PreviewLogoutController(IPreviewAvailability availability) : ControllerBase
{
    [HttpPost]
    public IActionResult Logout()
    {
        if (!availability.Enabled)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "no-store";
        return SignOut(new AuthenticationProperties { RedirectUri = "/auth/signed-out" },
            PreviewAuthentication.CookieScheme, PreviewAuthentication.OidcScheme);
    }
}
