using PolandExpenses.Domain.Accounts;
using PolandExpenses.UseCases.Authentication.Common;
using PolandExpenses.UseCases.Common;

namespace PolandExpenses.UseCases.Authentication.Register;

public sealed class RegisterHandler(IUserAccountRepository accounts, IPasswordService passwords, IAccessTokenIssuer tokens)
    : IUseCaseHandler<CredentialsRequest, TokenResponse>
{
    public async Task<Result<TokenResponse>> HandleAsync(CredentialsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!EmailAddress.TryCreate(request.Email, out var email) || !AuthenticationErrors.IsPasswordValid(request.Password))
        {
            return Result.Failure<TokenResponse>(AuthenticationErrors.InvalidInput);
        }

        if (request.Password!.Length < 12)
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
