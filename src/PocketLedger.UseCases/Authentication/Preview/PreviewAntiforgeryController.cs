using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace PocketLedger.UseCases.Authentication.Preview;

/// <summary>Supplies a request token bound to the authenticated preview browser.</summary>
[ApiController]
[Route("api/auth/preview/antiforgery")]
[Authorize(AuthenticationSchemes = PreviewAuthentication.CookieScheme)]
public sealed class PreviewAntiforgeryController(IAntiforgery antiforgery) : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult GetAntiforgery() => Ok(new { antiforgery.GetAndStoreTokens(HttpContext).RequestToken });
}
