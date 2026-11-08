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
| Daily spending | Sum of all the account’s expenses with a purchase date equal to today in the account’s saved time zone, including non-qualifying purchases. An empty day totals zero. |
| Available allowance | Opening carryover plus allowance earned through a date, minus qualifying expenses through that date. |
| Closing allowance | The available allowance at the end of a selected date. It may be negative. |
| Allowance period | A date range during which one daily allowance rate applies. |

`Europe/Warsaw` is the initial account time-zone preference. The saved regional zone defines current business dates; a recorded purchase date never shifts. Money remains PLN and is stored as integer grosz in Phase 1. Currency editing and multi-currency storage are planned later phases.

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
- The allowance calculation over dates, rate changes, and expense history.


## Account identity boundary

Authentication is a supporting module separate from budgeting. Keycloak is the sole credential authority. PocketLedger stores no password verifier and issues or accepts no first-party bearer tokens. `UserAccount` retains a stable local GUID, normalized `EmailAddress` snapshot, and optional `ExternalIdentity`. New accounts can only be provisioned with an exact trusted issuer and opaque case-sensitive subject. The subject is never parsed as a local GUID; session claims contain the resolved local account ID.

PostgreSQL uniquely constrains issuer/subject. Repeated or concurrent first resolution returns the same local owner; losing inserts read the winning row. Email is a non-unique snapshot, never an ownership key. Reusing any retained account’s email cannot transfer its expenses. Keycloak enforces trimmed, case-insensitive email registration and 12–128-character passwords; the domain does not verify credentials.

Legacy account rows without an external identity remain as inaccessible historical owners, with their expense foreign keys intact. The retirement migration removes verifier storage and the legacy email index, while retaining account rows, expenses, external identity mappings and browser tickets. It permits either both external identity fields or neither; a partial identity is invalid. There is no public factory for new identity-less accounts. No automatic migration, linking, reset or deletion occurs. See [ADR 0020](decisions/0020-keycloak-credential-retirement.md) and the [cutover procedure](learning/022-credential-retirement.md#cutover-and-fresh-account-procedure).

Infrastructure owns OIDC/session mechanics, protected PostgreSQL tickets, antiforgery and bounded callback/provider failure contracts. The default cookie session lasts 30 minutes idle and eight hours absolute. Hosted registration confirmation attests to server-created account registration, not email ownership. Browser recovery and session restoration do not alter expense or money rules. Phase 7 verifies clean setup and full-stack identity/expense persistence without changing these ownership rules; see [learning note 023](learning/023-reproducibility-and-persistence.md). Production enablement remains separate.

## Expense aggregate boundary

`Expense` is an entity and the root of its own small aggregate: one purchase is saved independently. Its ID and owner ID remain stable when purchase details change. A valid expense has a positive `Money` amount, a non-default purchase date no later than the captured account-local date for creation or explicit date changes, a nonblank free-text category (trimmed on write), an optional note, and an explicit allowance classification. Food and household categories ordinarily qualify, but this backend contract requires the caller to choose the flag; no automatic category classification is implemented.

`TryCreate` and `TryUpdate` enforce these invariants without depending on a clock or framework. Handlers capture preferences and one business instant through `IAccountContextReader`; the stateless `IBusinessCalendar` converts the explicit zone. Invalid updates change no fields. An unchanged stored date remains valid for non-date corrections even when a zone change makes it locally future. Backdating across month/year boundaries is allowed. Expense changes are persisted, but later allowance recalculation awaits the budget feature.

API ownership derives exclusively from the authenticated local account ID: the cookie session’s resolved external identity. Reads and aggregate loading filter by owner; owner ID is included in write predicates and enforced by a database foreign key. Foreign and missing expense IDs both produce 404. Category and note currently use PostgreSQL text without product-specific length limits. Read projections return only purchase fields and ID; pagination and revision history are not implemented.

## Financial preferences boundary

`AccountPreferences` is an independent aggregate referenced by local owner ID, outside credential/identity administration. All retained/new accounts start with PLN, Europe/Warsaw, empty recent usage and revision zero. A Settings zone change advances a checked revision, changes no currency intent, and never writes expenses. Authenticated updates require the last observed revision; stale updates return Conflict. The server catalogue supplies supported regional IANA identifiers and seasonal rules. An unavailable saved zone is retained and must be repaired explicitly in Settings.

The daily summary captures one date/zone/default/revision context and returns independent currency-labelled minor-unit totals, currently PLN only. Empty days return a zero entry in the captured default; unavailable data is never represented as zero. Multi-currency money and remembered selection behavior remain later phases. See [ADR 0024](decisions/0024-account-time-zone-and-summary-context.md).
