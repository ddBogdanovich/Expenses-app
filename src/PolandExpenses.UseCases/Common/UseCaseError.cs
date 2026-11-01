namespace PolandExpenses.UseCases.Common;

public enum UseCaseErrorType
{
    Validation,
    NotFound,
    Conflict,
    Unauthorized
}

public sealed record UseCaseError
{
    public UseCaseError(string code, string description, UseCaseErrorType type)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(code);
        ArgumentException.ThrowIfNullOrWhiteSpace(description);

        Code = code;
        Description = description;
        Type = type;
    }

    public string Code { get; }

    public string Description { get; }

    public UseCaseErrorType Type { get; }
}
