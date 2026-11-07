using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Authentication.Common;

internal static class AuthenticationErrors
{
    internal static readonly UseCaseError InvalidCredentials = new("auth.invalid_credentials", "The provider identity could not be verified.", UseCaseErrorType.Unauthorized);
}
