using PocketLedger.Domain.Accounts;
using PocketLedger.UseCases.Authentication.Common;
using PocketLedger.UseCases.Common;

namespace PocketLedger.UseCases.Authentication.ResolveExternalAccount;

public sealed record ResolveExternalAccountRequest(string Issuer, string Subject, string? Email);

/// <summary>Resolves a validated provider identity without linking by mutable email.</summary>
public sealed class ResolveExternalAccountHandler(IUserAccountRepository accounts)
    : IUseCaseHandler<ResolveExternalAccountRequest, Guid>
{
    public async Task<Result<Guid>> HandleAsync(ResolveExternalAccountRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (string.IsNullOrWhiteSpace(request.Issuer) || string.IsNullOrWhiteSpace(request.Subject) ||
            request.Issuer.Length > ExternalIdentity.MaximumIssuerLength || request.Subject.Length > ExternalIdentity.MaximumSubjectLength)
        {
            return Result.Failure<Guid>(AuthenticationErrors.InvalidCredentials);
        }

        var identity = ExternalIdentity.Create(request.Issuer, request.Subject);
        var existing = await accounts.FindByExternalIdentityAsync(identity, cancellationToken).ConfigureAwait(false);
        if (existing is not null)
        {
            return Result.Success(existing.Id);
        }

        if (!EmailAddress.TryCreate(request.Email, out var email))
        {
            return Result.Failure<Guid>(AuthenticationErrors.InvalidCredentials);
        }

        var account = UserAccount.Provision(email, identity);
        if (await accounts.TryAddAsync(account, cancellationToken).ConfigureAwait(false))
        {
            return Result.Success(account.Id);
        }

        existing = await accounts.FindByExternalIdentityAsync(identity, cancellationToken).ConfigureAwait(false);
        return existing is null
            ? Result.Failure<Guid>(AuthenticationErrors.InvalidCredentials)
            : Result.Success(existing.Id);
    }
}
