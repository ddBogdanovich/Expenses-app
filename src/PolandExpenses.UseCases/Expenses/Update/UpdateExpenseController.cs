using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PolandExpenses.UseCases.Common;
using PolandExpenses.UseCases.Expenses.Common;

namespace PolandExpenses.UseCases.Expenses.Update;

/// <summary>HTTP adapter for the update expense use case.</summary>
[ApiController]
[Authorize]
[Route("api/expenses")]
public sealed class UpdateExpenseController(UpdateExpenseHandler handler) : ControllerBase
{
    private readonly UpdateExpenseHandler _handler = handler ?? throw new ArgumentNullException(nameof(handler));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateAsync([FromRoute] Guid id, [FromBody] ExpenseInput request, CancellationToken cancellationToken)
    {
        var result = await _handler.HandleAsync(new UpdateExpenseRequest(id, request), cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => Ok(response));
    }
}
