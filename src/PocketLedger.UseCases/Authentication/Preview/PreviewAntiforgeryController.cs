using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace PocketLedger.UseCases.Authentication.Preview;

/// <summary>Supplies a request token bound to the authenticated preview browser.</summary>
[ApiController]
[Route("api/auth/preview/antiforgery")]
[Authorize(AuthenticationSchemes = PreviewAuthentication.CookieScheme)]
public sealed class PreviewAntiforgeryController(IAntiforgery antiforgery, IPreviewAvailability availability) : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult GetAntiforgery() => Ok(new { antiforgery.GetAndStoreTokens(HttpContext).RequestToken });

    /// <summary>Supplies a logout-only request token even after local session expiry.</summary>
    [HttpGet("/api/auth/preview/logout-token")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult GetLogoutToken() => availability.Enabled
        ? Ok(new { antiforgery.GetAndStoreTokens(HttpContext).RequestToken })
        : NotFound();
}
