using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace PocketLedger.UseCases.Common;

public static class ResultActionExtensions
{
    public static IActionResult ToActionResult<T>(this Result<T> result, Func<T, IActionResult> onSuccess)
    {
        ArgumentNullException.ThrowIfNull(result);
        ArgumentNullException.ThrowIfNull(onSuccess);

        if (result.IsSuccess)
        {
            return onSuccess(result.Value);
        }

        var error = result.Error!;
        var statusCode = error.Type switch
        {
            UseCaseErrorType.Validation => StatusCodes.Status400BadRequest,
            UseCaseErrorType.NotFound => StatusCodes.Status404NotFound,
            UseCaseErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            UseCaseErrorType.Conflict => StatusCodes.Status409Conflict,
            _ => throw new ArgumentOutOfRangeException(nameof(result), error.Type, "Unknown error type.")
        };

        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = error.Code,
            Detail = error.Description
        };
        problem.Extensions["code"] = error.Code;
        return new ObjectResult(problem)
        {
            StatusCode = statusCode,
            ContentTypes = { "application/problem+json" }
        };
    }
}
