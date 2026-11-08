# Plan: User currency and time-zone preferences

**PRD:** [prd-user-currency-timezone.md](prd-user-currency-timezone.md)
**Date:** 2026-11-08

## Planning assumptions and delivery rules

- This plan produces no application changes, migrations, tests, or data resets. Currency support is exactly PLN, BYN, USD, and EUR; all use two decimal places. History is protected against preference changes; intentional expense corrections/deletions remain available through the API. No conversion, country preference, full expense-history UI, or allowance calculation is included.
- Use the existing `tests/PocketLedger.E2E` real-Keycloak/API/two-PostgreSQL harness. Extend its browser journeys and isolated control facilities rather than introducing a second harness. Backend-only acceptance uses authenticated HTTP requests and disposable PostgreSQL, without requiring frontend changes. Keep clock/failure/restart controls confined to test infrastructure; do not add public production control endpoints.
- Before each phase's product changes, write/extend its acceptance tests and run them against the preceding working state. Record test names, repeatable commands, baseline revision/working-state identifier, expected and actual failures, and the final passing run in that phase's focused learning note. Add test setup first where necessary; unavailable infrastructure, compilation errors, broken fixtures, skipped tests, and unconditional failures are blocked setup, not valid red behavior.
- Already-green behavior stays regression evidence. Do not manufacture failures, weaken assertions, silently update screenshot baselines, or skip failures to obtain green. Documentation/verification-only work may have an already-green baseline with the reason recorded. Every phase requires its applicable acceptance tests, earlier regressions, and required checks to pass; blocked acceptance remains incomplete.
- Only Phase 1 mixes product frontend and backend changes. After that, backend phases remain independently verifiable through APIs; frontend phases consume already delivered contracts. Test-code changes across suites are permitted without changing product layer boundaries.
- Stabilize the currency-neutral daily-summary contract and renderer in Phase 1 while production expenses remain PLN. This prevents subsequent backend currency support from breaking the running daily page or exposing a misleading legacy combined total. All maintained consumers/tests/examples must move together; no permanent compatibility API is required by this PRD.
- Each substantial phase includes a focused learning note and affected documentation within its task budget. Explain new domain concepts with PocketLedger examples, alternatives, costs, and an exercise. Record consequential choices in the next available ADR (currently 0021; recheck at implementation time), preserve historical rationale, and mark superseded currency/calendar decisions accurately.
- Relevant source changes require backend build/tests/formatting or frontend build/lint/behavior tests, as applicable. Preserve coverage gates. Every UI phase also requires the project-local HeroUI/React/UI/UX skills, Playwright MCP inspection and screenshot review, and the complete [mobile/accessibility matrix](learning/014-mobile-layout-and-accessibility.md#verification-and-its-limits), including enlarged text, keyboard/focus, contrast, reduced motion, and physical iPhone limitations. Automated E2E does not replace this review.
- Preserve Keycloak/cookie/antiforgery security, owner-filtered queries, named application/identity volumes, and the on-demand dashboard test runner. Use repository Aspire skills and lifecycle checks for any orchestration changes. Stop verification-only resources and never use developer accounts or databases as fixtures.

Criteria C1–C18 refer to the PRD's Definition of done checkboxes in their existing order. A phase may make partial progress; the coverage table identifies where completion is verified.

## Implementation phases

### Phase 1: Deliver per-user time-zone Settings through the daily summary

**Goal:** Let a signed-in user save a time zone and immediately see their own local today, without changing stored expense dates. Establish the summary contract needed for later currencies.
**Layers:** fe / be / db
**Depends on:** none
**Covers:** C1–C3, C9–C12, C14–C18 (time-zone and summary foundations).
**Test-first gate:** Before implementation, add a browser journey from daily spending to Settings, save a non-Warsaw zone, reload, and verify the date/zone in the summary. Add real-database tests for old-account defaults, preference persistence/owner isolation, unchanged expenses, opposite-side date boundaries, daylight saving, and non-date corrections after a date becomes locally future. Run against the current app; missing Settings/account-zone behavior is the expected red result. Retain current login, expense, and empty/loading/error summary regressions.
**Delivery:** [PR #74](https://github.com/ddBogdanovich/Expenses-app/pull/74); [verification and learning note 024](learning/024-account-time-zone-settings.md). Production expenses and Settings currency remain PLN-only.

**Tasks:**

- [x] Record the financial-preferences ownership, exact date semantics, currency-neutral response shape, migration/contract transition, and clock-test strategy in an ADR/learning note. Read the existing domain/design rules and capture the current daily summary as the visual baseline; document this phase's intentionally PLN-only currency behavior.
- [x] Add focused account-owned preferences behavior/contracts under Domain and UseCases, plus EF persistence/migrations: PLN default, Europe/Warsaw zone, and initially empty recent usage. Supply defaults for existing and newly provisioned accounts without resets or identity changes. Add thin authenticated read/update Settings slices with owner-derived identity, antiforgery, validation, Result outcomes, and no-store responses.
- [x] Replace `Infrastructure/Expenses/WarsawBusinessCalendar.cs` and its singleton registration with an account-aware calendar boundary used by Create/Update/Today. Preserve `DateOnly` expense records; permit non-date corrections to an unchanged historical date even when it is now locally future, while rejecting new/changed future dates. Change the Today projection to return explicit date/zone and currency-labelled minor-unit totals, initially PLN only; update maintained consumers/tests/examples together.
- [x] Add the Settings route/navigation in `Web/src/App.tsx` and a feature-owned time-zone form using `PageShell`, `Notice`, and HeroUI. Keep currency visibly PLN until the later currency phases. Adapt `TodayPage.tsx`, `today-api.ts`, and `SpendingSummary.tsx` to the neutral collection contract, exact currency formatting for the four known codes, and the saved zone rather than browser/Warsaw assumptions; retain zero/loading/error semantics and correct date-boundary refresh.
- [x] Run the test-first browser/API scenarios to green, including session expiry, failures/cancellation, second-account isolation, restart, DST, and history comparison. Run affected backend/frontend checks, Playwright MCP/full matrix and UI/UX review; update README, root/frontend instructions, domain/design/reference examples, and the learning note with delivered behavior and red/green evidence.

**Definition of done:**

- [x] A signed-in user changes their zone in Settings and sees the saved zone's current date after save/reload; another account retains its own defaults. Invalid/forged updates leave preferences unchanged.
- [x] Existing expenses remain byte-for-byte equivalent in business fields, and the same instant can produce different account dates. New future dates are rejected; an unchanged historical date does not block other corrections.
- [x] The neutral summary renders PLN exactly, including empty/loading/error/large-total states, and can represent separate totals for all four supported codes without a later frontend contract change.
- [x] Applicable test-first cases and earlier regressions pass, red/green evidence is recorded, required checks and final UI review pass, and affected current/partial-scope documentation is consistent.

### Phase 2: Make money, expense contracts, and projections currency-aware

**Goal:** Allow API clients to record/read/correct PLN, BYN, USD, and EUR expenses and receive exact separate totals, preserving all legacy values.
**Layers:** be / db
**Depends on:** Phase 1
**Covers:** C1, C3, C8–C10, C12–C14, C16–C18.
**Test-first gate:** Before money/schema/API changes, add domain and real-PostgreSQL acceptance for all four currencies, unsupported values, precision/overflow, same/different-currency arithmetic, migration from the preceding schema, separate daily totals, and original-currency retention under explicit corrections. Run HTTP journeys against Phase 1 with authenticated owners; non-PLN round trips and per-currency totals should expose missing behavior. Run the Phase 1 browser suite unchanged before/after.
**Tasks:**

- [ ] Generalize `Domain/Money.cs` into an exact currency-bearing amount with named minor-unit policies for only the four supported codes. Replace production `Grosz`/`Zloty` assumptions, preserve signed balances/checked arithmetic, and reject invalid cross-currency operations; keep expense positivity in `Domain/Expenses/Expense.cs`.
- [ ] Add a reviewed EF migration/mapping in `ExpenseConfiguration.cs` and the snapshot to identify old expenses as PLN without numerical conversion. Preserve IDs, owners, dates, other fields, indexes/foreign keys, and historical migrations. Test upgrading populated legacy rows and integer boundaries rather than only creating an empty database.
- [ ] Update `Expenses/Common/ExpenseContracts.cs`, Create/Update/GetById/List/Today slices, repository/query implementations, validation/error text, and HTTP examples to explicit currency and exact minor-unit contracts. Preserve original stored currency for non-currency corrections, handle explicit amount/currency corrections, and retain the Phase 1 date/owner rules; never infer a recorded expense's currency from preferences.
- [ ] Replace `TotalGroszAsync`/single SQL sum with exact owner/date/currency projections compatible with the Phase 1 renderer. Return every currency present, with no cross-currency combined total; return default-currency zero only for an empty date. Update all maintained API consumers/fixtures, including retained E2E persistence/security scenarios, without introducing production frontend changes.
- [ ] Rerun test-first boundary/migration/owner/history/aggregation cases and prior browser regressions to green. Run backend build/tests/formatting and applicable coverage checks; update the domain model, README, agent instructions, relevant learning notes/ADR supersession, and API examples to distinguish delivered multi-currency APIs from pending currency-selection UI.

**Definition of done:**

- [ ] API creation/read/update/delete work with explicit currency and exact values for all four codes; unsupported/invalid inputs cause no partial write, and foreign IDs retain NotFound behavior.
- [ ] A populated pre-feature database upgrades with unchanged legacy numbers, IDs, ownership, dates, and other business fields; legacy amounts are explicitly PLN. Read/correction operations never silently relabel amounts with the current default.
- [ ] 10.00 PLN plus 5.00 EUR produces two labelled totals in both the API and the already delivered renderer; large same-currency sums retain precision, and empty/loading/error regressions pass.
- [ ] Applicable test-first cases and earlier regressions pass, red/green evidence is recorded, backend checks pass, and documentation describes the delivered contract accurately.

### Phase 3: Persist remembered currency and recent-first selection behavior

**Goal:** Make saved account currency choices and successful new expenses drive the next default consistently, with no changes from cancellations, rejected saves, or old-expense corrections.
**Layers:** be / db
**Depends on:** Phase 2
**Covers:** C2–C3, C5–C6, C10, C13, C15–C18 (backend behavior).
**Test-first gate:** Before preference/transaction changes, add real-service HTTP journeys saving EUR then USD expenses, explicitly saving BYN in Settings, repeating selections, changing only the zone, cancelling/rejecting requests, correcting/deleting old expenses, and reopening sessions. Assert exact default/recent ordering and no duplicate entries. Add failed-write/concurrent-request/retry cases proving expense and preference effects are consistent. Run against Phase 2 and record the missing remembered/default/ordering behavior; preserve cases already green.
**Tasks:**

- [ ] Complete preference rules and owned read/write slices for default currency and all-four recent usage, ordered by most recently committed selection before unselected currencies. Distinguish an explicit currency save from a zone-only save so zone changes do not invent a currency-selection event; validate all values and keep histories isolated per account.
- [ ] Extend new-expense application persistence to commit the purchase, remembered default, and recent-order effect consistently. Introduce only the focused transaction/retry contract needed by this feature alongside the relevant slices; retain aggregate-specific repositories and avoid a generic repository/framework. Bound retry handling so an uncertain response does not cause a duplicate purchase on resubmission.
- [ ] Ensure rejected/cancelled saves and failed transactions change neither default nor order. Keep edit/delete behavior independent of currency remembrance, including intentional corrections of older expenses; protect concurrent committed choices from lost/duplicated recent entries and document the ordering/consistency behavior.
- [ ] Rerun the test-first authenticated HTTP/database scenarios, prior currency/time-zone browser regressions, restart/second-browser persistence, and secret-free/antiforgery checks to green. Document the preference and purchase consistency lesson, update affected architecture/domain/API descriptions, and run backend checks/coverage gates.

**Definition of done:**

- [ ] Saving new EUR then USD expenses yields default USD and recent order USD, EUR before remaining codes, each exactly once; explicitly saving BYN makes BYN first. Zone-only updates do not change currency order.
- [ ] Cancellation, validation/failure rollback, and editing/deleting existing purchases preserve default/order; controlled retry does not duplicate an already committed expense. Concurrent choices produce a consistent persisted order without duplicate recent entries.
- [ ] Values survive reload, fresh browser login, and restart; one account cannot observe or mutate another's preferences. Applicable test-first cases and regressions pass, evidence is recorded, and backend checks/docs are complete.

### Phase 4: Complete currency Settings and recent-first pickers

**Goal:** Let users choose the default currency in Settings and see their own persistent recent-first ordering, while the existing daily summary responds to current preferences.
**Layers:** fe
**Depends on:** Phase 3
**Covers:** C2–C3, C5–C6, C9, C14–C18 (Settings UI).
**Test-first gate:** Before changing Settings UI, add browser cases opening currency choices after EUR/USD API-created expenses, explicitly saving BYN, reopening Settings/reloading/new browser login, zone-only edits, cancel/failure, session expiry, and independent second-account order. Run against Phase 3's time-zone-only Settings and record missing currency controls/behavior. Retain Phase 1–3 acceptance and reviewed layout baselines.
**Tasks:**

- [ ] Extend the Settings feature to load/save default currency and time zone through the delivered API. Use code/name labels and the server's recent-first complete ordering; preserve intent for zone-only versus explicit currency updates, rather than saving a stale default over a more recent expense choice.
- [ ] Add the feature-appropriate shared currency-picker presentation needed by Settings and later expense entry, using HeroUI directly and existing tokens. Preserve unique options, current selection, keyboard/touch access, visible focus, label association, and loading/unavailable states; do not create a new design system or palette.
- [ ] Complete Settings pending/success/validation/network/retry/cancel/expired-session behavior and navigation to today. Refresh summary context after save; ensure failure never displays zero as a substitute for unavailable preferences or silently claims a successful change.
- [ ] Add local design-reference cases for the reusable picker/states and multi-currency summary without API calls. Rerun the test-first Settings E2E scenarios and frontend behavior tests, build/lint, Playwright MCP/full matrix and UI/UX review to green; update design guidance, frontend instructions, README journeys, and learning-note evidence.

**Definition of done:**

- [ ] Settings exposes all four supported currency codes/names in the user's recent-first order, saves explicitly, persists across sessions, and leaves values/order unchanged after cancellation/failure or zone-only updates.
- [ ] Today's summary uses saved zone/default context, preserves separate totals, and distinguishes empty/loading/error states. Account and session-isolation regressions pass.
- [ ] Applicable test-first scenarios and earlier regressions pass, evidence is recorded, frontend checks and final full-matrix review pass, and examples/docs match the delivered Settings UI.

### Phase 5: Deliver the basic expense-entry form

**Goal:** Let a user record a purchase with a preselected currency and local date, override currency when needed, and see the resulting exact per-currency daily totals.
**Layers:** fe
**Depends on:** Phase 4
**Covers:** C4–C9, C14–C18 (expense-entry UI and integrated preference behavior).
**Test-first gate:** Before adding the form, write browser journeys from today's page to new expense, save 12.34 EUR then a USD purchase, reopen the form and inspect defaults/recent ordering, cancel/fail a BYN draft, and return to separate daily totals. Add a two-page same-account case changing Settings while a 12.34 EUR draft is open, plus backdated purchase, uncertain-response retry, explicit false classification, and session-expiry cases. Run against Phase 4; the absent entry action/form should fail behaviorally. Keep Settings/history/authentication regressions green.
**Tasks:**

- [ ] Add a feature-owned create-expense route/form and today's-page entry action in `Web/src/App.tsx`/`TodayPage.tsx`. Compose amount, currency, purchase date, category, optional note, and explicit allowance choice using `PageShell`, `Notice`, HeroUI, and the delivered picker. Load initial currency/local date from saved account context, without a mandatory currency-selection step.
- [ ] Add exact decimal input/validation and currency-aware request mapping without binary floating-point conversion; reject excessive precision, nonpositive amounts, invalid/future dates, missing category/classification, and unsupported currency values. Submit through the existing cookie/antiforgery boundary and the backend's retry-safe create contract.
- [ ] Keep each opened draft's amount/currency/date stable across preference refreshes or another tab's Settings changes. Preserve entered values after recoverable failure, protect repeated submissions, resolve uncertain save outcomes without duplicating expenses, and clear/reset the form only after verified success or intentional cancellation.
- [ ] Add accessible pending/error/success/return behavior and refresh daily context after success. A backdated purchase must save without incorrectly incrementing today's totals; the next new draft uses the latest persisted default/order. Keep cancellation and existing API correction behavior independent of currency remembrance.
- [ ] Rerun test-first real-service entry/draft/retry/mixed-total journeys and earlier regressions to green; run frontend build/lint/behavior tests and Playwright MCP/full matrix/UI/UX review. Update design/reference examples where reusable presentation changed, README/frontend instructions, and the expense-entry learning note with red/green evidence.

**Definition of done:**

- [ ] Users create valid PLN/BYN/USD/EUR purchases with currency/date already selected, optional note, and explicit true/false allowance classification; confirmed success leads to accurate totals and a newly remembered currency.
- [ ] Currency options are recent-first; failed/cancelled drafts do not change saved defaults/order, and an open EUR draft is not relabelled when Settings changes elsewhere. Repeated/uncertain saves do not create duplicate expenses or false success.
- [ ] Applicable test-first scenarios and earlier regressions pass, evidence is recorded, required frontend checks and final full-matrix review pass, and the basic form remains within the PRD's limited scope.

### Phase 6: Verify upgrade, restart, and integrated acceptance

**Goal:** Prove the completed feature preserves existing history and account security across upgrade, preferences, browser sessions, and service restart.
**Layers:** infra
**Depends on:** Phase 5
**Covers:** Final acceptance of C1–C18, especially C10–C12 and C16–C18.
**Test-first gate:** Before any setup/harness fixes, run retained upgrade/persistence journeys and the complete new acceptance suite against Phase 5. Extend missing scenarios first: populated pre-feature database upgrade, repeated currency/zone changes with exact history comparison, two users at opposite date boundaries, daylight-saving transitions, and full-stack restart. Record already-green verification evidence where no defect exists; any discovered setup/product defect needs a reproducing failing test before a fix in its owning phase.
**Tasks:**

- [ ] Extend `tests/PocketLedger.E2E/specs/persistence.spec.ts` and the existing harness controls to verify two users' preferences, default/recent order, mixed-currency expenses, and local identity ownership before/after full-stack restart. Repeat required current/retained-realm and user-free clean-source modes without developer data or changed Keycloak configuration.
- [ ] Run populated-database upgrade/history acceptance from the pre-feature schema; compare IDs, owners, exact amounts/currencies, dates, category/note/classification before/after repeated Settings changes. Include explicit edit/delete correction regressions and the locally-future historical-date edge case; do not infer missing historical timestamps.
- [ ] Run final backend build/domain/use-case/API tests/formatting and frontend build/lint/behavior tests plus applicable hook/CI/coverage checks. Exercise the dashboard test runner explicitly when affected and verify normal startup leaves it inactive. Validate through Aspire when service wiring changed; preserve all named volumes and session/security behavior.
- [ ] Perform final Playwright MCP and UI/UX review of Settings, expense creation, recent pickers, mixed totals, failures/retry, session expiry, and existing hosted authentication across the full documented browser/text matrix. Record physical iPhone follow-up limitations and return fixes to their owning phase before repeating affected checks.
- [ ] Audit all 18 PRD criteria against test-first and final evidence. Review README/diagrams, root/frontend instructions, domain/design docs, reference examples, HTTP examples, supported-currency lists, learning exercises, and ADR supersession links/commands; stop verification-only resources and report any remaining blocker rather than claiming completion.

**Definition of done:**

- [ ] Upgrade and full-stack restart preserve identity, preferences/recent usage, exact legacy PLN and new mixed-currency purchases, ownership, and date history, with no reset or production test-control route.
- [ ] Applicable E2E cases, prior regressions, backend/frontend checks, required coverage/CI gates, and final Playwright MCP/UI/UX review pass; baseline/final evidence is recorded and all 18 PRD criteria have acceptance evidence.
- [ ] Documentation describes implemented behavior accurately, PLN/Warsaw appear as defaults/examples rather than global rules, and currency conversion, history UI, and allowance calculations remain excluded.

## PRD coverage

| Criterion | Acceptance requirement | Completed in phase(s) |
| --- | --- | --- |
| C1 | Defaults and legacy-data preservation | 1, 2, 6 |
| C2 | Editable Settings and cross-session persistence | 1, 3, 4, 6 |
| C3 | Preference ownership, invalid-input/forged-request rejection | 1–4, 6 |
| C4 | Basic expense-entry journey | 5 |
| C5 | Remembered currency and recent-first complete picker | 3–5 |
| C6 | Explicit choice/cancel/failure/edit/delete ordering semantics | 3–5 |
| C7 | Open draft survives preference changes without relabelling | 5 |
| C8 | Exact supported currencies, precision, overflow and large totals | 2, 5 |
| C9 | Separate totals, default zero, distinct loading/error | 1, 2, 4, 5 |
| C10 | Preference changes preserve every saved expense field | 1–3, 6 |
| C11 | User-local today, midnight/DST, device/server independence | 1, 6 |
| C12 | Fixed recorded dates and locally-future correction rules | 1, 2, 6 |
| C13 | Explicit correction/delete and original currency/owner behavior | 2, 3, 6 |
| C14 | Currency/time-zone context throughout maintained behavior | 1, 2, 4, 5, 6 |
| C15 | Settings/form success, failure, pending, retry and expiry | 1, 3, 4, 5 |
| C16 | Test-first real-browser/database evidence | 1–6 |
| C17 | Backend/frontend checks and full MCP/UI/UX matrix | 1–6 |
| C18 | Documentation, reference, learning and ADR consistency | 1–6 |
