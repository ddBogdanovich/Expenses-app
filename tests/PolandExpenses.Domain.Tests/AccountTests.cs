using PolandExpenses.Domain.Accounts;

namespace PolandExpenses.Domain.Tests;

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
    public void RegistrationRequiresAPasswordVerifierAndAssignsUniqueIdentity()
    {
        Assert.True(EmailAddress.TryCreate("owner@example.com", out var email));
        Assert.Throws<ArgumentException>(() => UserAccount.Register(email, ""));
        var first = UserAccount.Register(email, "password-verifier");
        var second = UserAccount.Register(email, "another-verifier");
        Assert.NotEqual(Guid.Empty, first.Id);
        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal(email, first.Email);
        Assert.Equal("password-verifier", first.PasswordHash);
    }
}
