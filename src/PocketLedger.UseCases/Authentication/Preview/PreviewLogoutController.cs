using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace PocketLedger.UseCases.Authentication.Preview;

/// <summary>Ends the local session and navigates to provider sign-out.</summary>
[ApiController]
[Route("api/auth/preview/logout")]
[Authorize(AuthenticationSchemes = PreviewAuthentication.CookieScheme)]
public sealed class PreviewLogoutController : ControllerBase
{
    [HttpPost]
    public IActionResult Logout()
    {
        Response.Headers.CacheControl = "no-store";
        return SignOut(new AuthenticationProperties { RedirectUri = PreviewAuthentication.LandingPath },
            PreviewAuthentication.CookieScheme, PreviewAuthentication.OidcScheme);
    }
}
