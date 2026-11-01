using PocketLedger.Domain.Accounts;
using PocketLedger.UseCases.Authentication.Common;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Authentication.Register;

public sealed class RegisterHandler(IUserAccountRepository accounts, IPasswordService passwords, IAccessTokenIssuer tokens)
    : IUseCaseHandler<CredentialsRequest, TokenResponse>
{
    public async Task<Result<TokenResponse>> HandleAsync(CredentialsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!EmailAddress.TryCreate(request.Email, out var email) || !PasswordPolicy.IsInputValid(request.Password))
        {
            return Result.Failure<TokenResponse>(AuthenticationErrors.InvalidInput);
        }

        if (request.Password!.Length < PasswordPolicy.MinimumLength)
        {
            return Result.Failure<TokenResponse>(AuthenticationErrors.WeakPassword);
        }

        var account = UserAccount.Register(email, passwords.Hash(request.Password));
        if (!await accounts.TryAddAsync(account, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<TokenResponse>(AuthenticationErrors.DuplicateEmail);
        }

        return Result.Success(new TokenResponse(tokens.Issue(account)));
    }
}
