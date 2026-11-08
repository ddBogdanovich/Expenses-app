# 024. Account time-zone Settings

Phase 1 implementation for milestone 8, issues #43–#47. Multi-currency money storage and currency editing remain later phases. See [ADR 0024](../decisions/0024-account-time-zone-and-summary-context.md).

## Test-first evidence

Baseline: `675dfcfa755f1abeb16fc56b0e24d720c236dde4` (fresh origin/main), branch `codex/phase1-account-timezone`.

- `dotnet test tests/PocketLedger.Api.Tests --filter FullyQualifiedName~PreferencesTests`: test fixture initially required analyzer corrections (not behavioral red). After correction, all three executable tests fail against absent `/api/preferences` routes. The real PostgreSQL and authenticated session fixture ran successfully. The final preferences and expense suite is green.
- `npm --prefix tests/PocketLedger.E2E test -- time-zone-settings.spec.ts`: the baseline journey completed hosted login then timed out at the absent Settings button. The current daily summary was captured and visually inspected through Playwright MCP before product changes. All five final Settings journeys pass.

## Concepts

An aggregate is a unit whose rules are changed together. AccountPreferences owns its time zone and revision; Expense owns purchase facts. Changing Settings therefore writes one preferences row and cannot shift a purchase date. Keycloak owns credentials, not these financial decisions.

A date is a recorded calendar fact; an instant identifies a point on the UTC timeline. At `2026-11-08T00:30:00Z`, Warsaw's date is November 8 while Los Angeles's date is November 7. Both can read the same stored `2026-11-08` purchase without modifying it. A non-date correction remains valid after moving west; a new future purchase does not.

A captured context reads preferences and one business instant once per operation. A singleton clock can be shared safely; a singleton holding an account's database preferences cannot. The alternative of database I/O inside a synchronous Today property hides I/O and risks lifetime bugs.

A revision is a version of preferences. Two forms loaded at revision 0 cannot both overwrite each other: the first save advances it and the second must reload after Conflict. It does not make expense POST retry-safe; that is Phase 3's separate command-receipt concern.

Exercise: choose Kiritimati then Los Angeles at the same instant. Which date is today? Why must changing a note on yesterday's saved purchase not require rewriting its recorded date? What happens when two tabs save the same revision?

## Verification evidence (2026-11-08)

- Domain baseline: `dotnet test tests/PocketLedger.Domain.Tests --filter FullyQualifiedName~UnchangedLocallyFuture` failed at the expected rejected non-date correction. The unchanged-date rule is now green with new/changed future dates still rejected.
- `dotnet build PocketLedger.slnx --no-restore`: zero warnings/errors. `dotnet test PocketLedger.slnx --no-build`: 125 passing tests (25 Domain, 5 UseCases, 95 API). `dotnet format PocketLedger.slnx --no-restore --verify-no-changes` passes.
- API `PreferencesTests` and `PreferencesMigrationTests` prove defaults, persistence, no-store, CSRF, owner isolation, independent-context concurrent revision writes, opposite-side midnight, six Warsaw DST fixtures, explicit unavailable-zone repair, and exact history preservation. The migration test upgrades populated retained legacy/external accounts and compares every expense field through PostgreSQL row JSON. These expanded boundary/upgrade fixtures were added during implementation; the pre-product red gate is the three original HTTP tests, browser journey, and domain correction test above.
- `npm --prefix src/PocketLedger.Web run build`, `run lint`, and `test -- --run`: strict build/lint and all 72 tests pass. Tests cover owner changes during periodic verification, temporary hiding/restoration of drafts, catalogue failure/retry, stale forms, and an old in-flight summary resolving after save/return. All four formatter codes retain exact digits beyond Int64 aggregate size.
- `npm --prefix tests/PocketLedger.E2E test`: all 36 tests pass on a fresh disposable Keycloak/API/two-PostgreSQL stack, including the retained full-stack restart scenario. After the final picker filtering/validation corrections, all five affected `time-zone-settings.spec.ts` journeys pass again, including a fresh browser credential login after API restart, saved preferences/history, invalid input after a successful save, interrupted-save recovery and session expiry. No developer account/database was used.
- The earlier historical credential-retirement migration regression now asserts irreversibility at that migration's own boundary, before applying the later additive preferences migration. It retains every original assertion; otherwise a deliberate attempted downgrade could remove the newer preferences migration before the older irreversible step rejects it.
- Independent read-only review found and then approved fixes for draft loss, account changes while content remained mounted, and catalogue retry with a restored draft. No Critical/Important findings remain.
- Working-tree coverage collection passed. The exact committed comparison against main is run before PR delivery and repeated by CI; see the implementation PR for the final gate outcome.

### Browser/UI review

Playwright MCP captured and visually inspected the original summary and final Settings/today screenshots at 1440×1000, 440×956, 430×932, 428×926, 414×896, 375×812, 320×568, 956×440, 768×1024 and 440×420, each at 100% and 200% root text. The final matrix had no horizontal overflow, undersized controls, or clipped action labels. Shared light styling remains explicit under dark preference; reduced motion was tested. A separate touch-enabled mobile context completed hosted registration → Settings → saved zone → landscape daily summary.

MCP exercised searchable city filtering (`Los_Angeles` gives only `America/Los_Angeles`), ArrowDown/Enter selection and confirmed persistence, invalid text before/after a successful save, success focus, failed save/retained selection/retry, conflict/reload, expiry hiding, and visibility-triggered draft recovery. Local design-reference samples cover independent PLN/BYN/USD/EUR, zero, loading, error/retry and a sum exceeding Int64 at desktop and 320px/200% text. Final field error has `aria-invalid=true` and focus; page and success focus are meaningful. No unresolved issue remains in the project-local UI/UX skill review.

Measured composed contrast: body/canvas 13.23:1, muted/canvas 5.02:1, muted/card 5.36:1, primary text/accent 9.67:1, input text/background 13.58:1, input border/background 3.09:1, focus/card 5.81:1, error text/background 6.42:1 and success text/background 8.55:1. Scoped compact card padding, full-size suggestion targets and input end padding fixed the initial small-target/clipping findings; the selected identifier also appears in wrapping helper text. Artifacts remain under ignored `output/playwright/`, never alongside credentials in committed documentation.

Physical iPhone Safari, real safe-area insets, browser chrome, software keyboard, autofill and VoiceOver remain separate follow-up limits; Chromium emulation does not prove them. No AppHost/resource wiring changed, so the developer volumes and explicit dashboard test runner are unchanged. Verification-only services are stopped after review.

## Bounded drafts and uncertain saves

App retains one `SettingsMemory` instance, scoped to its reactively verified account ID. It survives temporary protected-page unmounts while the form remains hidden until access is verified. Explicit cancellation/navigation away, logout and a different verified owner clear it. This is in-memory UI state, not browser storage or a cookie claim. A restored draft waits for a successfully loaded catalogue before becoming editable; network failures retain it and offer retry.

A request can commit even if the browser stops waiting. An interrupted Settings save therefore shows an uncertain outcome and offers reload/review or retry with the original revision. A committed first attempt yields Conflict on retry rather than an unnoticed second overwrite. This approach does not claim expense POST idempotency; Phase 3 supplies that separate contract. Alternatives include keeping hidden components mounted or browser storage, both with additional disclosure/lifetime costs.

Exercise: hold a Settings response, switch tabs, return and retry. Explain why cancellation of fetch does not prove rollback, and why a new request must not silently replace the original revision.
