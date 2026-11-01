using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PolandExpenses.UseCases.Common;
using PolandExpenses.UseCases.Expenses.Common;

namespace PolandExpenses.UseCases.Expenses.Create;

/// <summary>HTTP adapter for the create expense use case.</summary>
[ApiController]
[Authorize]
[Route("api/expenses")]
public sealed class CreateExpenseController(CreateExpenseHandler handler) : ControllerBase
{
    private readonly CreateExpenseHandler _handler = handler ?? throw new ArgumentNullException(nameof(handler));

    [HttpPost]
    public async Task<IActionResult> CreateAsync([FromBody] ExpenseInput request, CancellationToken cancellationToken)
    {
        var result = await _handler.HandleAsync(request, cancellationToken).ConfigureAwait(false);
        return result.ToActionResult(response => Created(new Uri($"/api/expenses/{response.Id}", UriKind.Relative), response));
    }
}
