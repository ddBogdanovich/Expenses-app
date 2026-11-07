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
| Daily spending | Sum of all the account’s expenses with a purchase date equal to today in Warsaw, including non-qualifying purchases. An empty day totals zero. |
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
- The allowance calculation over dates, rate changes, and expense history.


## Account identity boundary

Authentication is a supporting module separate from budgeting. The paragraphs below describe the default legacy flow; the development preview adds the independent external identity boundary described afterward. A `UserAccount` aggregate has a stable ID, an `EmailAddress` value object, and an opaque password verifier. Email identity is trimmed and case-insensitive (stored uppercase); PostgreSQL enforces one account per normalized email, including concurrent registration attempts. Registration creates an account; login only retrieves and verifies one. Password hashing and JWT cryptography belong to Infrastructure, not the domain.

No plaintext password is stored. Registration's application-level `PasswordPolicy` accepts 12–128 characters; empty/null credentials and malformed emails are rejected. A login failure uses the same response for an unknown email and a wrong password. Access tokens expire after 30 minutes. Expense ownership is implemented: each expense references its account by ID, with no embedded account or expense collection on the account aggregate. Budget plans and their ownership are still to model.

### External identity preview

An external account has a stable local GUID, an email snapshot, and an `ExternalIdentity` containing the exact trusted issuer and opaque case-sensitive subject. It has no password verifier. PostgreSQL enforces unique issuer/subject independently from the legacy-only unique email index. A new external identity using a legacy email creates an independent account and cannot inherit its expenses. Repeated resolution, including after API restart, returns the same local GUID. The provider subject is never parsed as a local GUID; application-owned claims contain only the resolved local ID.

Credential verification belongs to Keycloak, protocol/session mechanics and protected ticket storage belong to Infrastructure, and account provisioning is an application use case. Browser cookies do not alter expense or money rules. The preview provider enforces trimmed, case-insensitive email registration with a 12–128-character password. A provider email remains a snapshot, even after that normalization: only exact issuer/subject defines local ownership. Repeated or concurrent first resolutions return one local account; unique database conflicts recover by reading the winning row. The hosted preview now confirms creation using the authenticated provider identity in a transaction-only required action; it does not verify email ownership or change the ownership boundary. Local identity/session resolution follows confirmation continuation. Abandoning confirmation retains the provider account. The default legacy flow remains available during preview; its removal and full failure handling remain planned. See ADRs 0014–0016 and learning notes 017–018.

## Expense aggregate boundary

`Expense` is an entity and the root of its own small aggregate: one purchase is saved independently. Its ID and owner ID remain stable when purchase details change. A valid expense has a positive `Money` amount, a non-default purchase date no later than the current Warsaw date, a nonblank free-text category (trimmed on write), an optional note, and an explicit allowance classification. Food and household categories ordinarily qualify, but this backend contract requires the caller to choose the flag; no automatic category classification is implemented.

`TryCreate` and `TryUpdate` enforce these invariants without depending on a clock or framework. Handlers supply today's date through `IBusinessCalendar`; invalid updates change no fields. Backdating across month/year boundaries is allowed. Expense changes are persisted, but later allowance recalculation awaits the budget feature.

API ownership derives exclusively from the authenticated local account ID: the legacy validated subject or the resolved external identity. Reads and aggregate loading filter by owner; owner ID is included in write predicates and enforced by a database foreign key. Foreign and missing expense IDs both produce 404. Category and note currently use PostgreSQL text without product-specific length limits. Read projections return only purchase fields and ID; pagination and revision history are not implemented.
