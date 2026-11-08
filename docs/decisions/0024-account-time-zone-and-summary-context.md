# ADR 0024. Account-owned time zones and a currency-neutral daily summary

- Status: Accepted
- Date: 2026-11-08
- Partially supersedes: [ADR 0011](0011-daily-spending-projection.md), fixed Warsaw date and scalar total contract only

## Decision

Financial preferences are an independent, account-owned aggregate, outside Keycloak and cookie claims. A one-to-one preferences row references the stable local account ID. The migration backfills every retained account with PLN, Europe/Warsaw, empty recent usage, and revision zero. New identity provisioning inserts the defaults in the same database save. No expense columns or values are rewritten.

Authenticated `GET /api/preferences`, `PATCH /api/preferences`, and `GET /api/preferences/time-zones` use the existing controller/handler, Result, cookie, antiforgery and no-store boundaries. Phase 1 permits only explicit time-zone changes; currency remains PLN. PATCH requires a decimal-string `expectedRevision`; optimistic concurrency rejects stale forms. Later currency selection must be explicit and omitted currency must mean no change. Revision and monetary totals travel as integer strings.

A scoped asynchronous context reader loads preferences once per operation. A stateless calendar converts one UTC instant from a separate business clock into the explicit saved zone. The clock wraps TimeProvider in production; tests can replace only the business clock without expiring real authentication tickets. The server catalogue contains runtime-supported regional IANA IDs. Saved IDs must resolve; an unavailable stored zone produces an actionable error, never a silent Warsaw fallback. Catalogue aliases are accepted only if listed by the server, stored unchanged, and never inferred from browser settings. Supported deployment hosts require ICU/tzdata.

PurchaseDate remains a DateOnly/PostgreSQL date. Create and explicit date corrections reject future dates in the captured account context. An unchanged stored date is allowed for non-date corrections even if a zone change makes it locally future. Preference changes never call expense write operations.

`GET /api/expenses/today` replaces the scalar total with `{purchaseDate,timeZone,preferencesRevision,defaultCurrency,hasExpenses,totals:[{currency,amountMinorUnits}]}`. Phase 1 produces only PLN entries while the renderer accepts PLN/BYN/USD/EUR independently. An empty day includes one PLN zero entry. PostgreSQL sums bigint to numeric and returns digits as text; totals are never narrowed. All maintained clients/tests/examples transition together; there is no legacy response endpoint.

Settings sits within the verified-session boundary and uses the existing shell/tokens and HeroUI searchable ComboBox. Save is explicit, with pending/error/retry/cancel and success feedback. Returning to today mounts a new reader and aborts the previous generation; old responses cannot relabel newer totals. Periodic/visibility refresh accepts the server date, independent of browser clock skew. No new OIDC return destination is added. App retains one bounded in-memory Settings draft across temporary verification, keyed by reactive verified owner identity. It hides protected content until verification, clears on intentional cancellation/logout/owner change, and presents interrupted saves as uncertain with reload/retry. No browser storage is used.

## Alternatives and costs

Putting financial preferences on UserAccount would couple budgeting writes to identity provisioning; separate rows add a join/read and a migration. Optimistic revision checks are sufficient for infrequent Phase 1 settings edits; Phase 3 must add per-owner transaction serialization for expense creation plus remembered currency. Browser-derived dates would avoid a server clock abstraction but violate the saved-zone rule. Fixed offsets cannot represent seasonal clock changes. Storing instants instead of purchase dates would invent historical information.

## Verification

Use the existing disposable real-Keycloak/API/PostgreSQL harness for browser journeys and real PostgreSQL HTTP tests for ownership, CSRF, persistence, migration and history comparison. Test opposite-side midnight and Warsaw DST with a business-only clock. Preserve summary loading/error/empty/large-number regressions and review the final UI through Playwright MCP across learning note 014's matrix. Evidence and unresolved checks belong in [learning note 024](../learning/024-account-time-zone-settings.md); this ADR is not a claim that acceptance has passed.
