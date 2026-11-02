using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Expenses.Today;

/// <summary>HTTP adapter for today's expense total use case.</summary>
[ApiController]
[Authorize]
[Route("api/expenses")]
public sealed class TodayExpenseController(TodayExpenseHandler handler) : ControllerBase
{
    private readonly TodayExpenseHandler _handler = handler ?? throw new ArgumentNullException(nameof(handler));

    [HttpGet("today")]
    public async Task<IActionResult> GetAsync(CancellationToken cancellationToken)
    {
        var result = await _handler.HandleAsync(TodayExpenseRequest.Instance, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => Ok(response));
    }
}
