using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PocketLedger.UseCases.Common;
using PocketLedger.UseCases.Expenses.Common;

namespace PocketLedger.UseCases.Expenses.GetById;

/// <summary>HTTP adapter for the get expense use case.</summary>
[ApiController]
[Authorize]
[Route("api/expenses")]
public sealed class GetExpenseController(GetExpenseHandler handler) : ControllerBase
{
    private readonly GetExpenseHandler _handler = handler ?? throw new ArgumentNullException(nameof(handler));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetAsync([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _handler.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => Ok(response));
    }
}
