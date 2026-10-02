# Domain model

## Purpose

The application answers one primary question: **how much may I spend today while staying within my rolling everyday budget?**

It records other expenses too, but only qualifying expenses affect that allowance.

## Ubiquitous language

| Term | Meaning |
| --- | --- |
| Budget plan | The owner's allowance policy, beginning on a chosen local date. |
| Daily allowance | The amount earned for one calendar day. Initially 50.00 PLN. |
| Opening carryover | An optional signed amount applied when the budget plan starts. |
| Qualifying expense | An expense that reduces the rolling everyday allowance. Food and household purchases qualify by default. |
| Non-qualifying expense | A recorded expense that remains visible but does not reduce the allowance. |
| Available allowance | Opening carryover plus allowance earned through a date, minus qualifying expenses through that date. |
| Closing allowance | The available allowance at the end of a selected date. It may be negative. |
| Allowance period | A date range during which one daily allowance rate applies. |

`Europe/Warsaw` defines calendar dates. Money is PLN and is stored as integer grosz.

## Core rule

For a date on or after the plan starts:

```text
available allowance
  = opening carryover
  + sum of daily allowances from the start date through the selected date
  - sum of qualifying expenses through the selected date
```

The selected date is inclusive. No scheduled midnight transfer is needed: elapsed dates and recorded expenses determine the result.

## Worked examples

Assume a plan starts on 2026-09-20 with a 50.00 PLN daily allowance and zero opening carryover.

| Scenario | Calculation | Closing allowance |
| --- | --- | ---: |
| Spend 35.00 PLN on day one | 50.00 - 35.00 | 15.00 PLN |
| Spend 80.00 PLN on day one | 50.00 - 80.00 | -30.00 PLN |
| Day two after spending 80.00 on day one | 2 × 50.00 - 80.00 | 20.00 PLN |
| Record no qualifying expenses for three days | 3 × 50.00 | 150.00 PLN |
| Record a 120.00 PLN train ticket outside the allowance on day one | 50.00 - 0.00 | 50.00 PLN |

## Decisions for the first release

- Carryover continues across month and year boundaries.
- An allowance can be negative; debt is recovered by future daily allowances.
- A future allowance-rate change starts on its effective date and does not rewrite history.
- Backdated expense changes recalculate every later balance.
- Expense amount positivity belongs to the expense model. `Money` itself supports signed values because balances can be negative.
- Future-dated expenses are not accepted in the first release.

## Still to model

- `BudgetPlan`, including start date, opening carryover, and allowance periods.
- `Expense`, including amount, purchase date, category, note, and whether it qualifies.
- The allowance calculation over dates, rate changes, and expense history.

