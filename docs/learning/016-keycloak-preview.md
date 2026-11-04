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

## Implementation and green evidence

Implemented the additive external-account mapping, server-side ticket store, isolated cookie/OIDC schemes, CSRF filter, native hosted login/logout, development-only preview, and independent identity resources. Production output inspection found no preview/design-reference route imports. The existing default account flow remains current; hosted registration/profile policy and complete recovery remain later phases.

- `dotnet test PocketLedger.slnx --artifacts-path .artifacts/tests`: 22 Domain, 3 UseCases, and 65 API tests passed with real disposable PostgreSQL. New cases cover opaque identity/restart, no legacy-email linking, session absolute expiry, and renewal after revocation. Existing persistence/duplicate-email/token/expense tests remain green.
- `npm run check:frontend`: build/lint and 28 behavior tests passed. `npm test`: 11 tooling tests passed, including idempotent URL configuration, preservation of client credentials/unrelated settings, and failed-bootstrap no-write behavior.
- `npm --prefix tests/PocketLedger.E2E test`: both retained journeys passed with real Keycloak 26.8.1 and disposable identity/application PostgreSQL. The preview journey creates a 42.37 PLN expense, restarts the API, verifies the same local ID/session/expense, rejects missing/tampered credentials and mixed-scheme crossover, rejects missing/invalid CSRF for otherwise-valid expenses with unchanged total, and completes provider/local logout plus revoked-cookie replay rejection. No browser password grant is used.
- Review corrected two test weaknesses without weakening product assertions: wait for provider confirmation rather than taking an immediate visibility snapshot; test valid expense payloads rather than confusing model-validation 400 with CSRF rejection. The enabled real-service suite now proves scheme selection with both credential types present.
- Aspire reported Keycloak/API/web healthy and `keycloak-config` success after ordinary restarts with the existing realm/database retained. Browser URLs must use the raw public endpoint URL rather than container-rebased host names. The Node resource integration supplies certificate trust; no TLS verification was disabled.
- A frontend dependency-install collision exposed shared test/developer files. The harness now owns an independent frontend copy/dependencies and cleans up whole child process groups. The revised full suite passed alongside Aspire.

The explicit dashboard test run and final browser inspection are recorded below; a blocked environment check is not green evidence.

## Exercise

1. Why do two users with the same email but different trusted subjects need separate PocketLedger GUIDs?
2. Explain why a preview-selection header cannot replace a session cookie or an antiforgery token.
3. What happens if an in-flight request renews a session after logout deletes it? How can an update-only renewal prevent resurrection?
4. Why does persisting a session table fail to preserve login if the API loses its Data Protection keys?

## Current environment interruption

After earlier backend/E2E green runs, the explicitly started dashboard test resource encountered Docker `read-only file system` errors while creating disposable PostgreSQL containers. Provider/browser requests were also affected. This is infrastructure failure, not an expected red test or proof of an authentication defect. Verification services were stopped before attempting Docker Desktop recovery. Dashboard exit-code evidence and final affected browser checks remain outstanding until recovery/rerun; do not mark Phase 1 complete based only on prior passes.

The bounded `docker desktop restart --timeout 45` recovery attempt failed because Docker processes did not stop before its deadline. No force reset, image prune, or volume deletion was attempted. The source review has no remaining must-fix findings, but the PR stays draft: tasks 1–3 are implemented; tasks 4–5 retain outstanding browser/dashboard verification. Final solution formatting passed. The 20-case hosted login viewport/text matrix had no horizontal overflow; visual inspection confirmed the 200% tablet reflow fix. Full credential/pending/logout MCP checks could not finish after the runtime interruption, so final UI acceptance is not claimed.
