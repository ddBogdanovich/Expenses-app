using Microsoft.AspNetCore.Routing;

namespace PolandExpenses.UseCases.Common;

/// <summary>
/// Defines one HTTP endpoint module that is discovered at application startup.
/// </summary>
public interface IEndpoint
{
    void MapEndpoint(IEndpointRouteBuilder endpoints);
}
