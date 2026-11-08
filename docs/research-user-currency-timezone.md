# Research: implementing user currency and time-zone preferences

**Date:** 2026-11-08

**Status:** Implementation recommendations; no feature implementation or accepted ADR

**Inputs:** [PRD](prd-user-currency-timezone.md), [implementation plan](plan-user-currency-timezone.md)

## Recommendation

Keep the existing modular monolith and add a small account-owned financial-preferences aggregate. Represent each expense amount as exact integer minor units plus an explicit currency, retain its purchase date, and calculate today using the account's saved regional time zone. Use one database transaction for a new expense, its remembered currency, and a durable retry receipt.

This is the best fit for this repository's current scope: four two-decimal currencies, one maintainer, existing PostgreSQL, simple date-based purchases, and no exchange rates. It requires no new service, messaging, event sourcing, general-purpose money framework, production date library, or replacement UI framework. These are project-specific recommendations inferred from the code and cited platform capabilities, not claims that one design is universally optimal.

The plan's six phases can remain ordered as written. The main refinements are to settle the neutral read contract in Phase 1, prove the EF money mapping early in Phase 2, and design save/retry consistency before the expense form is implemented.

## What exists and why it matters

| Current code | Finding | Consequence |
| --- | --- | --- |
| [Money.cs](../src/PocketLedger.Domain/Money.cs) | Signed `long Grosz`, PLN conversion, checked arithmetic; no currency identity | Rename the concept to minor units and make currency part of equality and arithmetic |
| [Expense.cs](../src/PocketLedger.Domain/Expenses/Expense.cs) | `DateOnly` purchase date; shared validation rejects any date after today, including unchanged dates on update | Preserve the date model, but distinguish creating/changing a date from correcting other fields |
| [ExpenseContracts.cs](../src/PocketLedger.UseCases/Expenses/Common/ExpenseContracts.cs) | `AmountGrosz`, a single `TotalGroszAsync`, synchronous global `IBusinessCalendar.Today` | Introduce explicit currency contracts and an asynchronously loaded account context |
| [ExpenseRepository.cs](../src/PocketLedger.Infrastructure/Expenses/ExpenseRepository.cs) | `AddAsync` calls `SaveChangesAsync` immediately | Two repository calls cannot by themselves guarantee atomic expense/default/retry effects |
| [ExpenseConfiguration.cs](../src/PocketLedger.Infrastructure/Persistence/ExpenseConfiguration.cs) | Money converted into one bigint column; owner/date index and owner foreign key | Map currency separately without replacing the table or losing ownership constraints |
| [ExpenseQueries.cs](../src/PocketLedger.Infrastructure/Expenses/ExpenseQueries.cs) | Parameterized SQL sum casts the aggregate to text | Keep this precision-preserving approach, adding currency grouping |
| [DependencyInjection.cs](../src/PocketLedger.Infrastructure/DependencyInjection.cs) | Warsaw calendar is registered as a singleton | Request/account data must not be captured in that singleton |
| [UserAccount.cs](../src/PocketLedger.Domain/Accounts/UserAccount.cs) and [identity-resolution handler](../src/PocketLedger.UseCases/Authentication/ResolveExternalAccount/ResolveExternalAccountHandler.cs) | Stable local identity, provider identity mapping, no financial preferences | Own preferences by local GUID; do not put financial defaults into Keycloak or cookie claims |
| [TodayPage.tsx](../src/PocketLedger.Web/src/features/today/TodayPage.tsx) and [SpendingSummary.tsx](../src/PocketLedger.Web/src/features/today/SpendingSummary.tsx) | Browser-side Warsaw date checks and fixed Warsaw copy | Use server-returned calendar context and remove hardcoded geographic claims |
| [today-api.ts](../src/PocketLedger.Web/src/features/today/today-api.ts) | BigInt-based exact formatting is already implemented for PLN | Generalize the existing formatter rather than replacing it with floating-point conversion |
| [App.tsx](../src/PocketLedger.Web/src/App.tsx) | Session checking can unmount protected content on visibility/history changes | A new form needs an owner-scoped draft lifetime independent of temporary verification rendering |
| [E2E harness guide](../tests/PocketLedger.E2E/README.md) | Real hosted authentication, disposable databases, restart/fault controls | Extend retained tests instead of building another acceptance environment |

The code inspected is the local working tree on this date. The PRD and plan are present locally; this research does not assume those files or the feature are already published or implemented.

## Decisions and alternatives

| Concern | Recommended choice | Alternative and cost |
| --- | --- | --- |
| Preferences ownership | Separate `FinancialPreferences` aggregate keyed by account GUID | Putting everything on `UserAccount` is fewer types but couples frequent purchase/default writes to authentication identity |
| Expense money | `Money(MinorUnits, Currency)` in the domain; bigint plus currency code in PostgreSQL | Decimal columns can be exact, but change the established integer contract without a need; floating point is unsuitable |
| Money mapping | EF complex property mapped into two relational columns, subject to a pinned-provider proof | Owned reference object is a viable fallback with extra EF identity/tracking semantics; JSON obscures an ordinary grouping/filtering key |
| Recent currencies | At most four distinct codes in a preference-row `text[]`, newest first | A child table with ranks works but adds ordering maintenance for four items; timestamps require tie-breaking and clock assumptions |
| Write concurrency | Serialize currency-changing commands on the owner's preference row; use a revision for stale Settings writes | Optimistic retries can work, but add more conflict/reload paths to a tiny per-user workload |
| Create retries | Durable owner-scoped request receipt in the same transaction | Disabling a button handles double clicks, not a committed request whose response was lost |
| Calendar | `TimeProvider` plus `TimeZoneInfo`, explicit regional IANA IDs | Noda Time would add a dependency/data-provider choice; reconsider if timestamp/scheduling requirements appear |
| Currency selection UI | Existing HeroUI v3 Select with explicit server ordering | Search is unnecessary for four choices; an alphabetical default conflicts with the PRD |
| Time-zone UI | Existing HeroUI v3 ComboBox over a server-supported zone catalogue | A fixed-offset picker does not model seasonal rules; deriving the complete catalogue only from the browser can disagree with the server |

### 1. Domain money and exact contracts

Use a closed currency definition with PLN, BYN, USD, and EUR and named metadata for two fractional digits/100 minor units. Validate codes through an explicit allowlist; do not treat a syntactically valid three-letter string as supported. The PRD is the product allowlist; [SIX's ISO 4217 maintenance information](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html) is the authoritative reference when maintaining code metadata.

An immutable `Money` must include both amount and currency in equality. Preserve signed values for future balances, with positive amounts enforced by Expense. `Add` and `Subtract` require matching currencies; `Multiply` and `Negate` preserve currency and use checked arithmetic. Replace the global currency-less `Money.Zero` with `Zero(currency)`. If retaining a record struct, explicitly guard its default/uninitialized currency state; a C# default struct bypasses validating construction. Invalid input is a Result at the use-case boundary; internal incompatible-money arithmetic is a programming error.

Recommend decimal-digit strings for **all** monetary API fields, including individual expense minor units, not just aggregates. The database remains signed 64-bit per expense; JavaScript never needs to round a large JSON number before validation. Example proposed create payload:

```json
{
  "requestId": "8b27a0e5-8bab-4c7f-9362-a45b7d278441",
  "amountMinorUnits": "1234",
  "currency": "EUR",
  "purchaseDate": "2026-11-08",
  "category": "Food",
  "note": null,
  "qualifiesForAllowance": false
}
```

This is a proposed contract, not an existing endpoint body. Use separate create/update request records so creation-only retry identity does not leak into replace semantics. Require explicit currency on writes; selecting the default is a frontend convenience. Do not reinterpret an omitted currency as today's preference for a historical expense. A full replacement carries the expense's stored currency unless the caller intentionally changes it.

Keep UI amount entry as text. Accept a clear single decimal separator (`.` or `,`), normalize it, and construct minor units from digits using BigInt. Do not accept grouping separators or exponent notation; reject more than two fractional digits rather than rounding. Convert to/from invariant digit strings at the API boundary, validate the signed-64-bit bound, and retain named input-size limits. A value such as `1,234` must not ambiguously become either 1.234 or 1234. These parsing conventions are recommended UI details to record in the design guide before implementation.

For display, retain the current integer/BigInt `formatToParts` strategy, parameterize currency, force two digits for this scope, and use `currencyDisplay: "code"` where symbols could be ambiguous. Format the integer quotient and substitute the exact two-digit remainder; never pass `Number(minorUnits) / 100` to the formatter. The [ECMAScript internationalization specification](https://tc39.es/ecma402/#sec-intl.numberformat.prototype.formattoparts) supports structured number-format parts and BigInt mathematical input. This implementation can retain the established `pl-PL` monetary separators while keeping English UI copy; it does not invent a new locale preference.

### 2. Relational money mapping and safe upgrade

The existing one-column `HasConversion` cannot simply be extended to write two columns: [EF value converters map a property to one database column](https://learn.microsoft.com/en-us/ef/core/modeling/value-conversions#composite-value-objects). [EF Core 10 supports struct complex types](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/whatsnew#struct-support), making a complex money property a reasonable fit for this domain's immutable value semantics.

Preferred target mapping: `Amount.MinorUnits` to `AmountMinorUnits bigint`, `Amount.Currency` through a supported-code conversion to `CurrencyCode varchar(3)`. Keep these as ordinary columns, not a money JSON document. Before adopting the exact C# shape, prove constructor/materialization, immutable replacement, currency conversion, tracking, generated migration, and SQL projections with the repository's pinned Npgsql 10.0.3. Documentation establishes capability, not that an untested mapping snippet works with every private setter/constructor combination. If this proof fails, use an explicitly mapped owned reference value object rather than distorting domain behavior or serializing money into one opaque string.

Migration sequence:

1. Phase 1 adds the preference table, defaults for existing owners, and account-owned initialization for new accounts. Legacy retained identity-less owners may receive defaults without becoming authenticated owners.
2. Phase 2 **renames** `AmountGrosz` to `AmountMinorUnits`, adds explicit PLN currency metadata for all pre-feature expenses, and retains purchase dates unchanged. Do not divide/multiply old values or recreate expense/owner rows.
3. Preserve the positive-amount constraint and owner foreign key, and add a supported-code constraint. A PLN migration default identifies old data; it must not become a permanent fallback for incomplete future writes. The domain/API supplies currency explicitly.
4. Retain the owner/date index initially. Add currency as a key/include only if measured query plans justify it; four currencies do not by themselves justify another index.

Inspect generated SQL for destructive drop/add operations. EF's [migration guidance specifically requires reviewing scaffolded changes, including column renames](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/managing). Keep historical migrations. A downgrade after storing foreign currencies cannot safely turn them into implicit PLN: document the limitation rather than silently losing currency identity. Do not claim the change supports old and new application binaries concurrently; the local milestone updates maintained clients together, while rolling deployment compatibility would require a separate expand/contract rollout.

### 3. Preferences model and recent-first order

Proposed aggregate state:

```text
FinancialPreferences
  AccountId               stable owner and aggregate identity
  DefaultCurrency         initially PLN
  TimeZoneId              initially Europe/Warsaw
  RecentCurrencies        initially empty; distinct supported codes only
  Revision                named, monotonic application revision
```

Initialize new-account preferences with identity provisioning in the same persistence transaction. Backfill existing owners through the migration; avoid having GET requests create rows or silently applying fresh defaults after a failed database read. Keep the aggregate/repository contract beside its financial-preference behavior, and query projections in UseCases. No new projects or identity-provider fields are needed.

Store recent codes as a small PostgreSQL `text[]` mapped from an encapsulated .NET list/array. Npgsql documents [primitive array/list mapping and change detection](https://www.npgsql.org/efcore/mapping/array.html). Keep validation and reordering inside aggregate methods rather than allowing callers to mutate the collection. SQL constraints can bound entries to the four codes and length; domain tests must also prove uniqueness and replacement tracking. There is no need for a GIN index or analytics query over this array.

The ordering algorithm is deliberately independent of time:

```text
Commit EUR: [EUR]
Commit USD: [USD, EUR]
Commit EUR: [EUR, USD]

Picker = RecentCurrencies + SupportedCurrenciesExceptRecent
```

Unselected currencies need a deterministic fallback order, for example the approved catalogue order PLN, BYN, USD, EUR. That order applies only after the recent group and is an implementation detail, not permission to alphabetically reorder recent selections. Summary totals can have their own stable catalogue order; the PRD's recent-first rule applies to selection controls.

Use explicit command intent. A zone-only Settings request must not submit a stale default or call `RememberCurrency`. An intentional currency save does call it, even if the user chose the displayed default. Creating an expense calls it once; editing/deleting an old expense never does. Cancelled forms and rejected requests never reach a committing method. Store all four recent choices; do not infer recent usage by sorting expenses by purchase date, because backdating and later deletions would change it.

### 4. Transaction boundary, concurrent choices, and retry receipts

This is the most consequential change to current persistence. Use a focused UseCases port such as `ICreateExpenseCommitter`, with an Infrastructure implementation sharing the existing `ExpensesDbContext`. Keep business decisions in handlers/domain methods; the adapter owns transaction/locking and persistence coordination. Existing aggregate-specific repositories remain useful. Do not add a generic repository, MediatR, outbox, or distributed transaction to solve a single PostgreSQL write.

The operation should commit these effects together:

```text
new expense + updated preferences + durable create-request receipt
```

[EF transactions make grouped writes atomic](https://learn.microsoft.com/en-us/ef/core/saving/transactions). One `SaveChanges` can cover tracked mutations, but a read/lock/check/write sequence also needs an explicit surrounding transaction. The current repository's immediate save must be adapted or bypassed only through the focused commit port; calling two independently committing repositories is insufficient.

Recommended per-owner command sequence:

1. Begin transaction and lock the owner's existing preference row. Always acquire locks in the same order; perform no network/identity-provider calls while holding the lock.
2. Check the owner-scoped create receipt. Same request ID and canonical business payload returns the original create result without another insert or preference reorder. Same ID/different payload returns Conflict.
3. Capture the effective preference/calendar context, validate the intended purchase, apply `RememberCurrency`, and stage the expense and receipt.
4. Increment the preference revision, save, and commit. If anything fails, roll back the entire operation. Replays do not increment the revision.
5. Return confirmed success only after commit. If the connection fails during commit, the client retries with the **same** ID; receipt lookup resolves an already committed outcome.

PostgreSQL [row locks block conflicting updates until transaction completion](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS). This serializes only one account's infrequent purchase/Settings commands. It gives recent usage the order of committed commands rather than device clocks or HTTP arrival times. Independent accounts remain independent. The cost is PostgreSQL-specific locking and a short extra read; measure before replacing this with a more elaborate concurrency framework.

Alternative: optimistic concurrency with bounded full-command retries. EF provides [concurrency tokens](https://learn.microsoft.com/en-us/ef/core/saving/concurrency), and Npgsql can map [PostgreSQL `xmin`](https://www.npgsql.org/efcore/modeling/concurrency.html). These work, but retries must reload the complete preference state and avoid replaying a committed purchase. Prefer an application revision for UI stale-write detection, even when row locks serialize backend commands. Do not rely on behavior documented only for Npgsql 11: the repository currently pins 10.0.3.

Use `expectedRevision` for Settings mutations. A stale form returns Conflict and offers review/retry; do not silently overwrite a newer expense-selected currency. A revision alone does not solve lost-response create duplication. A transaction alone does not either.

Keep create receipts focused: owner ID, request UUID, canonical payload fingerprint, and the original response/expense identity. Enforce unique `(OwnerId, RequestId)`. The fingerprint must use normalized business values, not raw JSON property order. Do not cascade-delete a receipt when an expense is later deleted: replay must not recreate it. The original create response may be replayed as historical command outcome, but it must not update current preferences or resurrect a deleted purchase. Avoid a short arbitrary expiration that reintroduces duplicates; retain receipts for this milestone and define cleanup if/when data-retention requirements arise.

The form creates its request ID once per intended purchase. Retry with an unchanged payload reuses it; after editing an uncertain payload, first resolve the previous outcome or explicitly start a new intent. Do not automatically mint another ID and resend. Transaction failures are not proof that the server did not commit if the response was lost. The backend fingerprint/replay contract and the frontend retry UX must be designed together in Phase 3, before Phase 5 implements the form.

### 5. Account-local dates without rewriting history

Keep `PurchaseDate` as `DateOnly`/PostgreSQL `date`. A purchase date is a recorded calendar fact, not a UTC instant missing its zone. The [.NET DateOnly documentation](https://learn.microsoft.com/en-us/dotnet/standard/datetime/how-to-use-dateonly-timeonly#the-dateonly-structure) supports this distinction. Do not invent midnight timestamps, infer the user's historical location, or add a creation-zone snapshot merely to meet the current PRD.

Replace the singleton Warsaw calendar with two responsibilities:

- A scoped asynchronous reader obtains the authenticated account's effective preferences and revision once for the operation.
- A stateless calendar converts one captured UTC instant into that explicit zone and returns its local date. Domain behavior receives `today` as an argument, preserving its framework independence.

Keep `TimeProvider.System` available as a singleton clock, but never put an account preference/repository into that singleton. Do not do database I/O inside a synchronous `Today` property. The [TimeProvider abstraction](https://learn.microsoft.com/en-us/dotnet/standard/datetime/timeprovider-overview) gives testable instants; [TimeZoneInfo supports cross-platform regional identifiers when globalization/time-zone data is available](https://devblogs.microsoft.com/dotnet/date-time-and-time-zone-enhancements-in-net-6/).

Build the selectable regional-zone catalogue from server-supported IANA identifiers, normalize aliases deliberately, and require saved values to be resolvable. Do not accept arbitrary Windows IDs, offset-only strings, or browser guesses as persisted regional policy. Verify ICU/tzdata availability on supported hosts; do not enable invariant globalization as a workaround. The [IANA database changes with political/DST decisions](https://www.iana.org/time-zones), so catalogue and runtime data maintenance remain an operational responsibility. Do not silently fall back to Warsaw if a saved zone cannot be resolved; return an actionable failure and retain the stored value.

The browser can filter/display the server's catalogue, but is not the authority on allowed zones or today's date. This also tolerates differences between server and browser time-zone database versions. Display an expense's `YYYY-MM-DD` as a date-only value, using UTC only as a presentation anchor if a Date object is needed; never pass the recorded date through the user's zone to shift it into another day.

Important update rule, applied before mutating any fields:

```text
create: purchaseDate <= effectiveToday
update: unchanged stored date is allowed;
        changed purchaseDate must be <= effectiveToday
```

For example, changing from Pacific/Kiritimati to America/Los_Angeles can make an already stored date later than the new local today. The record remains valid; category/note/amount corrections and deletion must still work. A new purchase or explicitly changed future date is rejected. The existing shared `IsValid` predicate must be split to express this difference.

### 6. Proposed read/write contract and stale-response handling

Recommended slices retain the controller/handler pattern and `/api` prefix:

| Proposed endpoint | Responsibility |
| --- | --- |
| `GET /api/preferences` | Owner's default, regional zone, recent-first currency options, revision, and server-computed form date |
| `PATCH /api/preferences` | Explicit zone and/or currency-selection intent with expected revision; omission means no change |
| `GET /api/preferences/time-zones` | Supported catalogue; authenticated access consistent with Settings |
| `POST /api/expenses` | Explicit currency/minor units/date and stable create request ID |
| Existing expense read/replace/delete routes | Original stored currency and explicit corrections, unchanged owner security |
| `GET /api/expenses/today` | One operation's date/zone/preference context and exact grouped totals |

These names are a recommended technical design to settle in the Phase 1 ADR, not additional requirements to add to the PRD. No endpoint accepts a caller-selected owner ID. Preserve cookie authentication, antiforgery on mutations, no-store responses, and generic expected errors through Result. Financial settings remain outside Keycloak and are not cached into a long-lived cookie ticket.

Example daily response, stabilized in Phase 1 even while its underlying expenses are all PLN:

```json
{
  "purchaseDate": "2026-11-08",
  "timeZone": "Europe/Warsaw",
  "preferencesRevision": "7",
  "defaultCurrency": "EUR",
  "hasExpenses": true,
  "totals": [
    { "currency": "PLN", "amountMinorUnits": "1000" },
    { "currency": "EUR", "amountMinorUnits": "500" }
  ]
}
```

For an empty day, return `hasExpenses: false` and one zero entry in the captured default currency. Load preference context once and use that same captured date/default/revision throughout the response, even if another request changes Settings concurrently. This avoids mixing the selected day from one context with the empty-state currency of another. A later refresh can show the new context; a globally frozen database snapshot is unnecessary for this UI.

Group by currency in SQL and cast each `SUM(bigint)` to text. PostgreSQL [returns numeric for sums of bigint](https://www.postgresql.org/docs/17/functions-aggregate.html), so do not narrow aggregates back to C# `long` or `decimal` unnecessarily. Retain parameterized SQL through EF for this focused projection; there is no reason to add Dapper. A GROUP BY with no matching rows needs explicit empty-state handling; `COALESCE` inside each group does not create a missing group.

Frontend requests need an invalidation generation: discard a pre-save daily/preference response arriving after a successful Settings save. Clear old-context totals while refreshing rather than attaching a new zone label to old figures. Reuse existing periodic/visibility refresh with named intervals, but treat the returned server date as authoritative; browser clock skew must not make the app reject a correct server response or loop on midnight refresh. A lightweight cross-tab invalidation signal may request fresh preferences; it must not carry authentication material or reset another tab's draft.

### 7. UI and draft behavior

Use the existing layout and shared presentation, not the promotional account layout for every authenticated screen. Keep one primary save action, explicit Cancel/back navigation, inline validation plus actionable form errors, and meaningful focus on success/navigation. Both new routes remain inside the existing verified-session boundary; no new OIDC return destination is necessary if the current root-login continuation remains the product behavior.

Use [HeroUI v3 Select](https://heroui.com/en/docs/react/components/select) for the four currencies, rendering the server-ordered collection with stable code keys. Use [HeroUI v3 ComboBox](https://heroui.com/en/docs/react/components/combo-box) for searching the larger zone catalogue. The locally installed package exports both components. Verify exact props against the locked package during implementation; current online documentation can be newer than the lockfile. Prefer the existing labelled text input and a native date input through the established HeroUI form recipe over adding a date-picker dependency. Use an explicit yes/no allowance choice with no initial answer so false is a deliberate valid response.

Initialize a draft once from successful account-context loading, then keep its entered amount/currency/date independent of subsequent preference refreshes. Changing currency explicitly changes what the entered amount represents; it performs no FX conversion. React [ties component state to tree position and keys](https://react.dev/learn/preserving-and-resetting-state), so keying the form by preference revision or conditionally unmounting it on every session recheck would destroy this guarantee.

Retain a bounded, in-memory draft keyed to the verified account ID across temporary verification/loading screens. Hide it until access is verified; clear it on explicit logout, owner change, confirmed save, or intentional cancellation. Reauthentication may resume an in-memory draft only for the same verified owner. Do not persist financial drafts in browser storage merely to work around component lifetime. This requires making account identity available to draft ownership rather than reducing `/api/auth/me` to a boolean and trusting a history marker.

After an uncertain POST, preserve the draft and its request identity while resolving/retrying the original command. Do not show success before a confirmed receipt/result. Selecting BYN and cancelling changes neither the server default nor recents. A confirmed backdated purchase changes historical data but need not change today's sum; show success separately from whether a visible daily total increased.

## Research probes and limits

A read-only local Node probe used the existing quotient/remainder formatter pattern with minor units `9223372036854775808`. PLN, BYN, USD, and EUR all produced an exact fractional `08`; the PLN output was `92 233 720 368 547 758,08 PLN`. This demonstrates that the proposed generalization can retain precision beyond signed-64-bit aggregate size without a money-formatting dependency.

The same probe evaluated `2026-11-08T00:30:00Z`: Europe/Warsaw yielded `2026-11-08`, while America/Los_Angeles yielded `2026-11-07`. This is a concrete acceptance fixture for separate user-local dates; it does not assign a timestamp to any purchase.

The probe ran on the available Node v26.7.0 / ICU 78.3, not the documented Node 24 client baseline or a physical iPhone. It is research evidence, not browser/production acceptance. No EF mapping spike, database migration, feature test suite, visual acceptance, or performance benchmark was executed. Currency metadata here follows the approved PRD; the SIX XML download was not parsed by the web tool, so this research does not claim an independently downloaded ISO table check.

## Test-first implementation guidance by phase

| Phase | Red cases to establish before product changes | Green evidence required |
| --- | --- | --- |
| 1: zone Settings | Missing Settings/context behavior; wrong user-local today; unchanged locally-future date blocks non-date edit | Real browser Settings journey, database defaults/history checks, owner/CSRF rejection, local-date boundaries, neutral renderer regressions |
| 2: currency core | Non-PLN unsupported; currency-less arithmetic; wrong mixed sum; upgrade drops/changes values | Pinned-provider money round trip and migration proof, all four currencies, mixed/large totals, owner-filtered corrections |
| 3: consistency | Expense save does not remember currency; ordering lost under concurrency; duplicate retry | Real transactions/faults, same-key replay, mismatched payload Conflict, two racing choices, zone-only stale-form behavior, unchanged defaults after rejected operations |
| 4: currency Settings | No currency control/recent ordering; stale currency overwritten on zone-only save | Browser recents/save/cancel/failure/relogin and independent-owner journeys, complete MCP/UI/UX matrix |
| 5: basic form | No entry route/form; draft reset during refresh; repeated uncertain save duplicates | Actual hosted login → create → remembered default → separate totals, two-tab draft preservation, backdating, pending/failure/session recovery, complete MCP/UI/UX matrix |
| 6: final verification | Add a reproducing test for any newly discovered setup or upgrade defect; otherwise retain passing baselines | Populated pre-feature upgrade, real full-stack restart, current/retained-realm/user-free modes, all required checks and final evidence |

Use [Playwright's authenticated API request context](https://playwright.dev/docs/api-testing) for backend acceptance after actual hosted login, preserving cookies and antiforgery. Do not use password grants or mock authentication as end-to-end proof. Keep current Keycloak security/restart tests while updating only their maintained expense payload/response expectations at the contract transition.

Time tests need two independent controls: [Playwright Clock](https://playwright.dev/docs/clock) controls page-side Date/timers, while a test-host override controls the server's **business** clock. Browser emulation does not set API time. Do not advance the shared authentication clock by months to test an expense date: OIDC tickets/correlation/provider tokens still run on real identity-service time. Isolate business-clock injection and harness-only fault controls; no production time-setting route. A [FakeTimeProvider](https://learn.microsoft.com/en-us/dotnet/core/extensions/timeprovider-testing) is a suitable test-only dependency if used; centralize its version and do not add it to Domain.

Specific fixtures worth retaining:

- Midnight on opposite sides of UTC, before/after Warsaw's 2026 spring-forward and fall-back instants, and browser/server zones different from the account zone.
- A stored date that becomes locally future after switching from Kiritimati to Los Angeles, followed by allowed note/category correction, allowed deletion, and rejected new future purchase.
- Positive per-expense maximum and a grouped sum exceeding `long.MaxValue`; fractions smaller than one minor unit; zero/negative expense attempts; checked signed-money overflow.
- EUR → USD → EUR commits, repeated selection, failed BYN save, zone-only save, and edit/delete of an old expense, with exact expected recents/defaults.
- A database failure before commit and a dropped HTTP response after commit. The latter must return/reconcile the original expense on same-ID retry without repeating remembrance.
- Two independent users, two concurrent browser sessions for one user, and an old in-flight summary response arriving after a Settings save.
- A populated pre-feature schema with retained legacy owners and expenses. Compare actual fields before/after upgrade and preferences, not a freshly created empty database or mocked repository.

## Risks to resolve before committing the corresponding ADR

1. **Money materialization:** prove the selected immutable complex type with pinned EF/Npgsql. Keep a fallback mapped owned value object; do not assume new version support validates a particular constructor design.
2. **Settings intent/revision:** settle explicit selection versus omitted currency, stale-form Conflict presentation, and revision transport in Phase 1/3 contracts. The UI must not overwrite a newer remembered choice while saving only the zone.
3. **Retry response semantics:** settle receipt retention and replay after later edit/deletion, and the user interaction after an uncertain response. This is a focused technical design detail necessary to satisfy the existing no-duplicate requirement, not a general idempotency platform.
4. **Time-zone portability:** prove the chosen server catalogue on the actual supported OS/runtime; preserve aliases deliberately and detect unavailable stored zones. Date-only rendering should not depend on the browser recognizing every server identifier.
5. **Draft lifetime:** current protected-content unmounts can erase input. Prove account-scoped preservation through temporary verification and same-owner recovery without exposing data to a different owner.
6. **Phase size:** Phase 1 has broad foundations despite being one end-to-end slice. Implement its time-zone/UI/storage tasks in small test-first increments; keep Money/schema generalization in Phase 2 and currency editing in Phase 4. This research does not authorize adding more product scope or changing the existing issues.

These are implementation proof points, not unanswered product-scope questions. Record the final choices in the next available ADR and learning notes; do not mark this research itself as an accepted architecture decision.

## Suggested learning focus

- Explain a value object by showing why `1000 PLN` and `1000 EUR` are unequal and cannot be added without a conversion policy.
- Explain an aggregate/transaction boundary by tracing one expense save plus its remembered currency; ask what happens if the second database write fails.
- Explain idempotency by dropping a successful save response, then retrying the same intended purchase; contrast this with two deliberate identical purchases using different IDs.
- Explain date versus instant by changing the user's zone while keeping the stored `YYYY-MM-DD` unchanged. Ask why adding a UTC midnight would change the meaning of the data.
- Explain draft versus preference state by changing Settings in a second tab and verifying that an in-progress EUR amount stays EUR.

The linked platform documentation supports the implementation capabilities. The aggregate boundaries, proposed payloads, transaction sequence, receipt design, fallback ordering, and phase refinements are recommendations derived for PocketLedger and must be verified by the planned red/green tests.
