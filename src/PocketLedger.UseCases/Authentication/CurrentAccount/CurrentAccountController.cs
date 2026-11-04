using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Authentication.CurrentAccount;

/// <summary>Exposes the local account identity resolved by the selected authentication scheme.</summary>
[ApiController]
[Route("api/auth/me")]
[Authorize]
public sealed class CurrentAccountController(ICurrentAccount account) : ControllerBase
{
    /// <summary>Returns the authenticated account identity.</summary>
    /// <returns>The resolved local account ID.</returns>
    [HttpGet]
    public IActionResult GetCurrentAccount() => account.AccountId is { } id ? Ok(new CurrentAccountResponse(id.ToString())) : Unauthorized();
}

/// <summary>The resolved local account identity.</summary>
/// <param name="AccountId">The stable local account ID.</param>
public sealed record CurrentAccountResponse(string AccountId);
