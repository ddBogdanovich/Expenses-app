# Keycloak preview: protocol identity and application ownership

## What changes and why

The [Phase 1 plan](../plan-keycloak-authentication.md) introduces a development preview while retaining the current password/JWT flow. [ADR 0014](../decisions/0014-keycloak-development-preview.md) records the chosen design, expiration, theme tooling, and non-destructive cutover policy. Implementation and verification status below must distinguish completed evidence from pending work.

OIDC answers who authenticated with the provider. PocketLedger still decides which account owns an expense. A subject such as `external-owner` is a valid opaque identifier; it is not a local GUID. The trusted issuer plus subject resolves to one locally assigned account ID. Email equality is insufficient: a new Keycloak identity using a legacy email must not inherit its expenses.

A backend-for-frontend session keeps protocol work in the API. The browser holds an opaque cookie; the server stores the ticket. Cookies are attached automatically, so expense mutations and logout now need CSRF protection. The alternative SPA bearer approach avoids automatic cookie attachment but makes browser code responsible for provider tokens and renewal. A self-contained cookie is simpler but cannot revoke a copied ticket immediately without server state.

## Baseline and test-first evidence

Baseline: `d233787`, before product changes, on `codex/keycloak-phase-1-preview`. Harness preparation adds no authentication/product behavior.

- Playwright MCP captured and visually reviewed login, registration, and confirmation at desktop 1440×1000 and phone 440×956. Files: ignored `output/playwright/keycloak-baseline-{login,register,confirmation}-{desktop,phone}.png`. Confirmation uses an intercepted UI-only registration response and creates no developer account; it is a visual reference, not API correctness evidence.
- First automated harness attempt was blocked by a missing pinned Chromium executable. This was an infrastructure failure and is **not** the red acceptance result. Installed Chromium and reran.
- `npm --prefix tests/PocketLedger.E2E test`: the real disposable-PostgreSQL legacy registration → confirmation → spending → logout → login journey passed before product changes. No new red case applies to this already-working behavior.
- Preview journey failed as expected after 60 seconds waiting for the missing “Try Keycloak preview” link (`authentication.spec.ts:25`). Result: one passed, one failed; this is the behavioral red gate. The full provider-dependent continuation remains blocked until its fixture is introduced; a missing provider does not count as behavioral red evidence.

## Test and artifact discipline

Install with `npm --prefix tests/PocketLedger.E2E ci` and `npx --prefix tests/PocketLedger.E2E playwright install chromium`. `npm --prefix tests/PocketLedger.E2E test` owns disposable services and process cleanup. `test:external` requires an explicitly prepared test stack; do not run registration tests against developer data. Browser traces/video/screenshots are off in credential tests. Service logs and artifacts live under ignored `.artifacts/e2e` and `output/playwright`; they must never contain committed secrets.

Runtime acceptance, compatibility, API restart persistence, scheme isolation, final screenshots, and frontend/backend checks remain pending. This note will record commands and results as each task progresses; a task does not become complete merely because its code exists.

## Exercise

1. Why do two users with the same email but different trusted subjects need separate PocketLedger GUIDs?
2. Explain why a preview-selection header cannot replace a session cookie or an antiforgery token.
3. What happens if an in-flight request renews a session after logout deletes it? How can an update-only renewal prevent resurrection?
4. Why does persisting a session table fail to preserve login if the API loses its Data Protection keys?
