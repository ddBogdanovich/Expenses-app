using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace PolandExpenses.UseCases.Authentication.CurrentAccount;

/// <summary>Exposes the account subject validated by bearer authentication.</summary>
[ApiController]
[Route("auth/me")]
[Authorize]
public sealed class CurrentAccountController : ControllerBase
{
    /// <summary>Returns the authenticated account identity.</summary>
    /// <returns>The subject from the validated access token.</returns>
    [HttpGet]
    public IActionResult GetCurrentAccount() => Ok(new CurrentAccountResponse(User.FindFirstValue("sub")!));
}

/// <summary>The identity carried by a validated access token.</summary>
/// <param name="AccountId">The stable account subject.</param>
public sealed record CurrentAccountResponse(string AccountId);
