using PocketLedger.Domain.Accounts;

namespace PocketLedger.Domain.Tests;

public sealed class ExternalIdentityTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void OversizedProviderIdentifiersCannotBecomeAnOwnershipIdentity(bool oversizedIssuer)
    {
        var issuer = oversizedIssuer ? new string('i', ExternalIdentity.MaximumIssuerLength + 1) : "https://identity.example";
        var subject = oversizedIssuer ? "opaque" : new string('s', ExternalIdentity.MaximumSubjectLength + 1);
        Assert.Throws<ArgumentException>(() => ExternalIdentity.Create(issuer, subject));
    }

    [Fact]
    public void ProviderSubjectIsOpaqueAndScopedToItsExactIssuer()
    {
        var identity = ExternalIdentity.Create("https://identity.example/realms/ledger", "external-owner");
        Assert.NotEqual(identity, ExternalIdentity.Create("https://identity.example/realms/ledger", "EXTERNAL-owner"));
        Assert.NotEqual(identity, ExternalIdentity.Create("https://identity.example/realms/other", "external-owner"));
        Assert.NotEqual(identity, ExternalIdentity.Create("https://identity.example/realms/ledger/", "external-owner"));
    }

    [Fact]
    public void ExternalAccountHasAnIndependentLocalIdAndNoPasswordVerifier()
    {
        Assert.True(EmailAddress.TryCreate("owner@example.com", out var email));
        var identity = ExternalIdentity.Create("https://identity.example", "external-owner");
        var account = UserAccount.Provision(email, identity);
        Assert.NotEqual(Guid.Empty, account.Id);
        Assert.Equal(identity, account.ExternalIdentity);
        Assert.Null(typeof(UserAccount).GetProperty("PasswordHash"));
    }
}
