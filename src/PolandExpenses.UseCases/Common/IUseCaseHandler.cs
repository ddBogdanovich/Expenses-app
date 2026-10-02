namespace PolandExpenses.UseCases.Common;

/// <summary>
/// Defines the application boundary for one command or query.
/// </summary>
public interface IUseCaseHandler<in TRequest, TResponse>
{
    Task<Result<TResponse>> HandleAsync(TRequest request, CancellationToken cancellationToken);
}
