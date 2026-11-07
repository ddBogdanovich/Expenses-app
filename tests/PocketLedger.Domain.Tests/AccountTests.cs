using PocketLedger.Domain.Accounts;

namespace PocketLedger.Domain.Tests;

public sealed class AccountTests
{
    [Fact]
    public void EmailIdentityIgnoresCaseAndSurroundingWhitespace()
    {
        Assert.True(EmailAddress.TryCreate(" Owner@example.com ", out var first));
        Assert.True(EmailAddress.TryCreate("owner@EXAMPLE.COM", out var second));
        Assert.Equal(first, second);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("name")]
    [InlineData("Display Name <name@example.com>")]
    public void InvalidEmailCannotBecomeAValueObject(string? input)
    {
        Assert.False(EmailAddress.TryCreate(input, out var email));
        Assert.Null(email);
    }

    [Fact]
    public void ProvisioningRequiresExternalIdentityAndAssignsUniqueLocalIdentity()
    {
        Assert.True(EmailAddress.TryCreate("owner@example.com", out var email));
        var identity = ExternalIdentity.Create("https://identity.example", "opaque-subject");
        Assert.Throws<ArgumentNullException>(() => UserAccount.Provision(email, null!));
        var first = UserAccount.Provision(email, identity);
        var second = UserAccount.Provision(email, identity);
        Assert.NotEqual(Guid.Empty, first.Id);
        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal(email, first.Email);
        Assert.Equal(identity, first.ExternalIdentity);
    }
}
