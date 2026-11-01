using PocketLedger.Domain.Expenses;

namespace PocketLedger.Domain.Tests;

public sealed class ExpenseTests
{
    [Fact]
    public void PurchaseKeepsIdentityAndOwnerWhenDetailsChange()
    {
        var owner = Guid.NewGuid();
        var today = new DateOnly(2026, 11, 1);
        Assert.True(Expense.TryCreate(owner, new Money(3500), today, "Food", "Lunch", true, today, out var first));
        Assert.True(Expense.TryCreate(owner, new Money(3500), today, "Food", "Lunch", true, today, out var second));
        Assert.NotEqual(first.Id, second.Id);
        var id = first.Id;

        Assert.True(first.TryUpdate(new Money(1), new DateOnly(2025, 12, 31), "Transport", null, false, today));

        Assert.Equal(id, first.Id);
        Assert.Equal(owner, first.OwnerId);
        Assert.Equal(new Money(1), first.Amount);
        Assert.Equal(new DateOnly(2025, 12, 31), first.PurchaseDate);
        Assert.Equal("Transport", first.Category);
        Assert.Null(first.Note);
        Assert.False(first.QualifiesForAllowance);
    }

    [Theory]
    [InlineData(0, "Food", 0)]
    [InlineData(-1, "Food", 0)]
    [InlineData(1, null, 0)]
    [InlineData(1, " ", 0)]
    [InlineData(1, "Food", 1)]
    public void InvalidPurchaseCannotBeCreatedOrPartiallyUpdateAnExpense(long grosz, string? category, int daysAfterToday)
    {
        var owner = Guid.NewGuid();
        var today = new DateOnly(2026, 11, 1);
        var date = today.AddDays(daysAfterToday);
        Assert.False(Expense.TryCreate(owner, new Money(grosz), date, category, null, false, today, out var rejected));
        Assert.Null(rejected);
        Assert.True(Expense.TryCreate(owner, new Money(3500), today, "Food", "Lunch", true, today, out var expense));

        Assert.False(expense.TryUpdate(new Money(grosz), date, category, null, false, today));

        Assert.Equal(new Money(3500), expense.Amount);
        Assert.Equal(today, expense.PurchaseDate);
        Assert.Equal("Food", expense.Category);
        Assert.Equal("Lunch", expense.Note);
        Assert.True(expense.QualifiesForAllowance);
    }

    [Fact]
    public void MissingOwnerAndDefaultDateAreRejected()
    {
        var today = new DateOnly(2026, 11, 1);
        Assert.False(Expense.TryCreate(Guid.Empty, new Money(1), today, "Food", null, true, today, out _));
        Assert.False(Expense.TryCreate(Guid.NewGuid(), new Money(1), default, "Food", null, true, today, out _));
    }

    [Fact]
    public void LargestRepresentableAmountIsPreservedExactly()
    {
        var today = new DateOnly(2026, 11, 1);
        Assert.True(Expense.TryCreate(Guid.NewGuid(), new Money(long.MaxValue), today, "Food", null, true, today, out var expense));
        Assert.Equal(long.MaxValue, expense.Amount.Grosz);
    }
}
