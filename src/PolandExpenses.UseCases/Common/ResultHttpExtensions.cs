using Microsoft.AspNetCore.Http;

namespace PolandExpenses.UseCases.Common;

public static class ResultHttpExtensions
{
    public static IResult ToHttpResult<T>(this Result<T> result, Func<T, IResult> onSuccess)
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
            UseCaseErrorType.Conflict => StatusCodes.Status409Conflict,
            _ => throw new ArgumentOutOfRangeException(nameof(result), error.Type, "Unknown error type.")
        };

        return Results.Problem(
            statusCode: statusCode,
            title: error.Code,
            detail: error.Description,
            extensions: new Dictionary<string, object?>
            {
                ["code"] = error.Code
            });
    }
}
