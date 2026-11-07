using PocketLedger.Domain.Accounts;
using PocketLedger.UseCases.Authentication.ResolveExternalAccount;

namespace PocketLedger.UseCases.Tests;

/// <summary>Specifies deterministic recovery after losing a concurrent identity insert.</summary>
public sealed class ResolveExternalAccountTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task LosingInsertUsesTheWinningIdentityOrRejectsWhenNoWinnerExistsAsync(bool winnerExists)
    {
        var identity = ExternalIdentity.Create("https://identity.example/realms/ledger", "opaque-subject");
        Assert.True(EmailAddress.TryCreate("owner@example.com", out var email));
        var winner = winnerExists ? UserAccount.Provision(email, identity) : null;
        var repository = new ConflictingAccounts(identity, winner);
        var handler = new ResolveExternalAccountHandler(repository);

        var result = await handler.HandleAsync(new ResolveExternalAccountRequest(identity.Issuer, identity.Subject, email.Value), CancellationToken.None);

        Assert.NotNull(repository.AttemptedAccount);
        Assert.Equal(identity, repository.AttemptedAccount.ExternalIdentity);
        Assert.Equal(2, repository.IdentityReads);
        if (winner is not null)
        {
            Assert.True(result.IsSuccess);
            Assert.Equal(winner.Id, result.Value);
            Assert.NotEqual(repository.AttemptedAccount.Id, result.Value);
        }
        else
        {
            Assert.True(result.IsFailure);
            Assert.Equal("auth.invalid_credentials", result.Error?.Code);
        }
    }

    private sealed class ConflictingAccounts(ExternalIdentity expectedIdentity, UserAccount? winner) : IUserAccountRepository
    {
        internal int IdentityReads { get; private set; }

        internal UserAccount? AttemptedAccount { get; private set; }

        public Task<UserAccount?> FindByExternalIdentityAsync(ExternalIdentity identity, CancellationToken cancellationToken)
        {
            Assert.Equal(expectedIdentity, identity);
            IdentityReads++;
            return Task.FromResult(IdentityReads == 1 ? null : winner);
        }

        public Task<bool> TryAddAsync(UserAccount account, CancellationToken cancellationToken)
        {
            AttemptedAccount = account;
            return Task.FromResult(false);
        }
    }
}
