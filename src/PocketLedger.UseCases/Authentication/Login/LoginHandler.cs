using PocketLedger.Domain.Accounts;
using PocketLedger.UseCases.Authentication.Common;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Authentication.Login;

public sealed class LoginHandler(IUserAccountRepository accounts, IPasswordService passwords, IAccessTokenIssuer tokens)
    : IUseCaseHandler<CredentialsRequest, TokenResponse>
{
    public async Task<Result<TokenResponse>> HandleAsync(CredentialsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!EmailAddress.TryCreate(request.Email, out var email) || !PasswordPolicy.IsInputValid(request.Password))
        {
            return Result.Failure<TokenResponse>(AuthenticationErrors.InvalidInput);
        }

        var account = await accounts.FindByEmailAsync(email, cancellationToken).ConfigureAwait(false);
        // Verify a dummy hash too, so a missing account still incurs password verification work.
        if (!passwords.Verify(account?.PasswordHash ?? string.Empty, request.Password!) || account is null)
        {
            return Result.Failure<TokenResponse>(AuthenticationErrors.InvalidCredentials);
        }

        return Result.Success(new TokenResponse(tokens.Issue(account)));
    }
}
