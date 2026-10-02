namespace PolandExpenses.UseCases.Common;

public sealed class Result
{
    private Result(bool isSuccess, UseCaseError? error)
    {
        IsSuccess = isSuccess;
        Error = error;
    }

    public bool IsSuccess { get; }

    public bool IsFailure => !IsSuccess;

    public UseCaseError? Error { get; }

    public static Result Success() => new(true, null);

    public static Result<T> Success<T>(T value)
    {
        ArgumentNullException.ThrowIfNull(value);
        return new Result<T>(true, value, null);
    }

    public static Result Failure(UseCaseError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return new Result(false, error);
    }

    public static Result<T> Failure<T>(UseCaseError error)
    {
        ArgumentNullException.ThrowIfNull(error);
        return new Result<T>(false, default, error);
    }
}

public sealed class Result<T>
{
    private readonly T? _value;

    internal Result(bool isSuccess, T? value, UseCaseError? error)
    {
        IsSuccess = isSuccess;
        _value = value;
        Error = error;
    }

    public bool IsSuccess { get; }

    public bool IsFailure => !IsSuccess;

    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("A failed result has no value.");

    public UseCaseError? Error { get; }
}
