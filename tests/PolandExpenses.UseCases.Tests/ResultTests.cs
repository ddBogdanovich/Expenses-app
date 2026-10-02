using PolandExpenses.UseCases.Common;

namespace PolandExpenses.UseCases.Tests;

public sealed class ResultTests
{
    [Fact]
    public void SuccessfulResultExposesItsValue()
    {
        var result = Result.Success(42);

        Assert.True(result.IsSuccess);
        Assert.False(result.IsFailure);
        Assert.Equal(42, result.Value);
        Assert.Null(result.Error);
    }

    [Fact]
    public void FailedResultExposesItsError()
    {
        var error = new UseCaseError(
            "expense.not_found",
            "The expense was not found.",
            UseCaseErrorType.NotFound);

        var result = Result.Failure<int>(error);

        Assert.True(result.IsFailure);
        Assert.Same(error, result.Error);
    }

    [Fact]
    public void FailedResultDoesNotExposeAValue()
    {
        var error = new UseCaseError(
            "expense.conflict",
            "The expense has changed.",
            UseCaseErrorType.Conflict);
        var result = Result.Failure<int>(error);

        var exception = Assert.Throws<InvalidOperationException>(() => result.Value);

        Assert.Equal("A failed result has no value.", exception.Message);
    }
}
