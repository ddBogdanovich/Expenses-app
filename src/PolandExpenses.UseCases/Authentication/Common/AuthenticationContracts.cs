using PolandExpenses.Domain.Accounts;
using PolandExpenses.UseCases.Common;

namespace PolandExpenses.UseCases.Authentication.Common;

public sealed record CredentialsRequest(string? Email, string? Password);

public sealed record TokenResponse(string AccessToken);

public interface IPasswordService
{
    string Hash(string password);

    bool Verify(string passwordHash, string password);
}

public interface IAccessTokenIssuer
{
    string Issue(UserAccount account);
}

internal static class AuthenticationErrors
{
    internal static readonly UseCaseError InvalidInput = new("auth.invalid_input", "A valid email and a password of at most 128 characters are required.", UseCaseErrorType.Validation);
    internal static readonly UseCaseError WeakPassword = new("auth.weak_password", "Use at least 12 characters for the password.", UseCaseErrorType.Validation);
    internal static readonly UseCaseError DuplicateEmail = new("auth.email_exists", "An account with this email already exists.", UseCaseErrorType.Conflict);
    internal static readonly UseCaseError InvalidCredentials = new("auth.invalid_credentials", "The email or password is incorrect.", UseCaseErrorType.Unauthorized);

    internal static bool IsPasswordValid(string? password) => !string.IsNullOrWhiteSpace(password) && password.Length <= 128;
}
