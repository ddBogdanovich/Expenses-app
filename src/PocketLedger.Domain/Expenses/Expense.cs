using System.Diagnostics.CodeAnalysis;

namespace PocketLedger.Domain.Expenses;

/// <summary>A single purchase and its allowance classification, owned by one account.</summary>
public sealed class Expense
{
    private Expense(Guid id, Guid ownerId, Money amount, DateOnly purchaseDate, string category, string? note, bool qualifiesForAllowance)
    {
        Id = id;
        OwnerId = ownerId;
        Amount = amount;
        PurchaseDate = purchaseDate;
        Category = category;
        Note = note;
        QualifiesForAllowance = qualifiesForAllowance;
    }

    public Guid Id { get; private set; }
    public Guid OwnerId { get; private set; }
    public Money Amount { get; private set; }
    public DateOnly PurchaseDate { get; private set; }
    public string Category { get; private set; }
    public string? Note { get; private set; }
    public bool QualifiesForAllowance { get; private set; }

    /// <summary>Creates a purchase if its owner and business values are valid.</summary>
    public static bool TryCreate(Guid ownerId, Money amount, DateOnly purchaseDate, string? category, string? note,
        bool qualifiesForAllowance, DateOnly today, [NotNullWhen(true)] out Expense? expense)
    {
        expense = null;
        if (ownerId == Guid.Empty || category is null || !IsValid(amount, purchaseDate, category, today))
        {
            return false;
        }

        expense = new Expense(Guid.NewGuid(), ownerId, amount, purchaseDate, category.Trim(), note, qualifiesForAllowance);
        return true;
    }

    /// <summary>Replaces purchase details atomically; invalid input leaves every field unchanged.</summary>
    public bool TryUpdate(Money amount, DateOnly purchaseDate, string? category, string? note, bool qualifiesForAllowance, DateOnly today)
    {
        if (category is null || !IsValid(amount, purchaseDate, category, today))
        {
            return false;
        }

        Amount = amount;
        PurchaseDate = purchaseDate;
        Category = category.Trim();
        Note = note;
        QualifiesForAllowance = qualifiesForAllowance;
        return true;
    }

    private static bool IsValid(Money amount, DateOnly purchaseDate, string? category, DateOnly today) =>
        amount.Grosz > 0 && purchaseDate != default && purchaseDate <= today && !string.IsNullOrWhiteSpace(category);
}
