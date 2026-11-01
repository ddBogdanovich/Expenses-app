namespace PocketLedger.UseCases.Authentication.Common;

/// <summary>Defines the credential policy shared by registration and login validation.</summary>
public static class PasswordPolicy
{
    /// <summary>The minimum length required when registering a new account.</summary>
    public const int MinimumLength = 12;

    /// <summary>The maximum accepted input length for either credential flow.</summary>
    public const int MaximumLength = 128;

    /// <summary>Checks required input and the upper bound without imposing registration rules on existing accounts.</summary>
    public static bool IsInputValid(string? password) =>
        !string.IsNullOrWhiteSpace(password) && password.Length <= MaximumLength;
}
