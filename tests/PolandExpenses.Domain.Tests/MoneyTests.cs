using PolandExpenses.Domain;

namespace PolandExpenses.Domain.Tests;

public sealed class MoneyTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(12.34, 1234)]
    [InlineData(-0.01, -1)]
    public void FromZlotyConvertsExactAmountsToGrosz(decimal zloty, long expectedGrosz)
    {
        var money = Money.FromZloty(zloty);

        Assert.Equal(expectedGrosz, money.Grosz);
        Assert.Equal(zloty, money.Zloty);
    }

    [Fact]
    public void FromZlotyRejectsFractionalGrosz()
    {
        var exception = Assert.Throws<ArgumentException>(() => Money.FromZloty(1.001m));

        Assert.Equal("zloty", exception.ParamName);
    }

    [Fact]
    public void ArithmeticPreservesSignedValues()
    {
        var dailyAllowance = Money.FromZloty(50m);
        var expense = Money.FromZloty(80m);

        var balance = dailyAllowance - expense;
        var nextDayBalance = balance + dailyAllowance;

        Assert.Equal(Money.FromZloty(-30m), balance);
        Assert.Equal(Money.FromZloty(20m), nextDayBalance);
    }

    [Fact]
    public void MultiplicationUsesCheckedArithmetic()
    {
        var amount = new Money(long.MaxValue);

        Assert.Throws<OverflowException>(() => amount * 2);
    }
}
