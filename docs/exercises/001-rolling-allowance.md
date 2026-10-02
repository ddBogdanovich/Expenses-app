# Exercise 001: Calculate a rolling allowance

Read [Learning note 001](../learning/001-value-objects-and-money.md) before starting. We will review the concept and your answers to its four questions before reviewing the implementation.

## Goal

Implement the first domain service that calculates a balance for one fixed daily allowance. This exercise deliberately precedes allowance-rate changes and the `Expense` aggregate.

## Contract

Create `RollingAllowanceCalculator` in the domain project with this public method:

```csharp
public Money Calculate(
    DateOnly planStartDate,
    DateOnly throughDate,
    Money dailyAllowance,
    Money openingCarryover,
    Money qualifyingExpenses)
```

The result includes both `planStartDate` and `throughDate`.

## Required behavior

- Return opening carryover plus one daily allowance for every included day, minus qualifying expenses.
- Reject a `throughDate` earlier than `planStartDate`.
- Reject a daily allowance that is zero or negative.
- Allow opening carryover and the calculated result to be negative.
- Rely on `Money` checked arithmetic rather than silently overflowing.

## Acceptance examples

For a plan beginning on 2026-09-20 with 50.00 PLN per day and no opening carryover:

| Through date | Qualifying expenses | Result |
| --- | ---: | ---: |
| 2026-09-20 | 35.00 PLN | 15.00 PLN |
| 2026-09-20 | 80.00 PLN | -30.00 PLN |
| 2026-09-21 | 80.00 PLN | 20.00 PLN |
| 2026-09-22 | 0.00 PLN | 150.00 PLN |

Write the tests first. Keep the calculator free of system-clock, database, and time-zone dependencies: it receives already-resolved calendar dates.

## Design questions for review

1. Should `qualifyingExpenses` accept a negative amount, and which model should enforce that rule?
2. Is this calculator a domain service, a value object, or behavior that should eventually move onto `BudgetPlan`?
3. What makes a test valuable here beyond repeating the arithmetic expression?
