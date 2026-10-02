namespace PolandExpenses.Domain;

/// <summary>
/// A signed amount of Polish currency represented as integer grosz.
/// </summary>
public readonly record struct Money
{
    public static Money Zero => new(0);

    public Money(long grosz)
    {
        Grosz = grosz;
    }

    public long Grosz { get; }

    public decimal Zloty => Grosz / 100m;

    public static Money FromZloty(decimal zloty)
    {
        var grosz = zloty * 100m;

        if (grosz != decimal.Truncate(grosz))
        {
            throw new ArgumentException("An amount cannot contain a fraction of one grosz.", nameof(zloty));
        }

        return new Money(decimal.ToInt64(grosz));
    }

    public Money Add(Money addend) =>
        new(checked(Grosz + addend.Grosz));

    public Money Subtract(Money subtrahend) =>
        new(checked(Grosz - subtrahend.Grosz));

    public Money Negate() =>
        new(checked(-Grosz));

    public Money Multiply(long multiplier) =>
        new(checked(Grosz * multiplier));

    public static Money operator +(Money left, Money right) => left.Add(right);

    public static Money operator -(Money left, Money right) => left.Subtract(right);

    public static Money operator -(Money value) => value.Negate();

    public static Money operator *(Money value, long multiplier) => value.Multiply(multiplier);
}
