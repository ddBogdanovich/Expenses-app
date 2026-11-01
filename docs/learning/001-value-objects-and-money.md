# Learning note 001: Value objects and `Money`

## The problem before the pattern

The budgeting domain contains amounts such as 50.00 PLN, 35.00 PLN, and -30.00 PLN. A plain `decimal` can store those numbers, but it does not express the domain rules:

- Is the number PLN, EUR, a percentage, or a quantity?
- May it contain fractions smaller than one grosz?
- Should arithmetic overflow silently?
- Does `50.00` mean the same thing wherever it appears?

When those answers live only in developers' heads, every caller must remember them. The type system cannot help us.

## What a value object is

In Domain-Driven Design, a **value object** describes a domain concept by its attributes rather than by an identity.

Two 50.00 PLN amounts are interchangeable. We do not ask which particular 50 zł object we have. If their values are equal, they are equal for the domain.

A useful value object normally has these properties:

- **Value equality:** equality compares its contents.
- **No identity:** it has no database ID or lifecycle of its own.
- **Immutability:** an operation produces another value rather than changing the existing one.
- **Valid construction:** invalid representations are rejected at the boundary.
- **Domain behavior:** relevant operations live with the value instead of being repeated by callers.

Value objects are a tactical DDD pattern. They help make the ubiquitous language executable: code says `Money` rather than “a decimal that everyone knows means PLN.”

## Value object versus entity

| Question | Value object | Entity |
| --- | --- | --- |
| What defines equality? | Its attributes | Stable identity |
| Does its history matter? | Usually no | Usually yes |
| Typical update | Replace it with a new value | Change the same identified object |
| Example in this app | `Money` | `Expense` |

Correcting an expense does not create a conceptually interchangeable expense just because the amount and date match. The expense has a stable identity, so it is an entity. Revision history is not yet implemented. Two `Money.FromZloty(50m)` values are interchangeable, so `Money` is a value object.

## Why `Money` is implemented this way

[`Money.cs`](../../src/PocketLedger.Domain/Money.cs) is a `readonly record struct`:

- `record` supplies value-based equality.
- `readonly` prevents mutation after construction.
- `struct` makes this small value behave like a number and avoids a heap allocation in common use.
- `long Grosz` is the canonical representation, so supported values are exact multiples of 0.01 PLN.
- `FromZloty` is a named conversion boundary that rejects fractional grosz.
- Checked operators turn numeric overflow into an error instead of corrupting a balance.

The type is signed because a balance can be negative. Positivity is contextual: an `Expense` amount must be positive, but `Money` itself also represents opening carryover and calculated balances. That invariant belongs to the `Expense` model, not to every monetary value.

## Why not use `decimal` everywhere?

Using `decimal` directly is initially shorter, but it spreads currency and precision rules across handlers, database mappings, and UI conversions. It also permits nonsensical calls such as passing a percentage where an amount is expected.

The value object pays for itself when a rule has more than one caller. It does not justify wrapping every primitive. A note can remain a `string` until the domain gives it behavior or invariants worth centralizing.

## Why not model multiple currencies now?

The product is explicitly PLN-only. Adding a currency code, exchange rates, and cross-currency arithmetic today would encode a hypothetical requirement and make every operation more complex. If multi-currency support becomes real, `Money` is the natural place to introduce that rule deliberately.

## Limitations to remember

- `default(Money)` is valid and equals zero because this is a struct. That is acceptable for monetary arithmetic, but it would be dangerous for a value whose absence must be distinguished from zero.
- Formatting is a presentation concern. The domain exposes a value; the UI decides whether it appears as `50,00 zł` or `PLN 50.00`.
- Persistence concerns stay outside the value object. EF Core mapping will adapt this type to a database column later.

## Check your understanding

Before Exercise 001, be able to answer:

1. Why should two separate 50.00 PLN instances compare equal?
2. Why is a negative `Money` valid while a negative expense is not?
3. Which rule would force us to revisit the PLN-only representation?
4. Why would adding an ID to `Money` make the model worse?
