using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PolandExpenses.UseCases.Common;
using PolandExpenses.UseCases.Expenses.Common;

namespace PolandExpenses.UseCases.Expenses.Delete;

/// <summary>HTTP adapter for the delete expense use case.</summary>
[ApiController]
[Authorize]
[Route("api/expenses")]
public sealed class DeleteExpenseController(DeleteExpenseHandler handler) : ControllerBase
{
    private readonly DeleteExpenseHandler _handler = handler ?? throw new ArgumentNullException(nameof(handler));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteAsync([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _handler.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => NoContent());
    }
}
