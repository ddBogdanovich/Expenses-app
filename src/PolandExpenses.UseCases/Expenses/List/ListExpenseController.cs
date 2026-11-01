using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PolandExpenses.UseCases.Common;
using PolandExpenses.UseCases.Expenses.Common;

namespace PolandExpenses.UseCases.Expenses.List;

/// <summary>HTTP adapter for the list expense use case.</summary>
[ApiController]
[Authorize]
[Route("api/expenses")]
public sealed class ListExpenseController(ListExpenseHandler handler) : ControllerBase
{
    private readonly ListExpenseHandler _handler = handler ?? throw new ArgumentNullException(nameof(handler));

    [HttpGet]
    public async Task<IActionResult> ListAsync(CancellationToken cancellationToken)
    {
        var result = await _handler.HandleAsync(ListExpensesRequest.All, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => Ok(response));
    }
}
