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

The explicit dashboard test run and final browser inspection passed after the environment recovery recorded below. Phase 1 is complete; at that phase boundary, registration and failure hardening remained planned. The Phase 2 continuation below records the registration policy now implemented.

## Exercise

1. Why do two users with the same email but different trusted subjects need separate PocketLedger GUIDs?
2. Explain why a preview-selection header cannot replace a session cookie or an antiforgery token.
3. What happens if an in-flight request renews a session after logout deletes it? How can an update-only renewal prevent resurrection?
4. Why does persisting a session table fail to preserve login if the API loses its Data Protection keys?

## Environment interruption and recovery

After earlier backend/E2E green runs, the explicitly started dashboard test resource encountered Docker `read-only file system` errors while creating disposable PostgreSQL containers. Provider/browser requests were also affected. This was infrastructure failure, not an expected red test or proof of an authentication defect. Verification services were stopped before attempting Docker Desktop recovery.

The bounded `docker desktop restart --timeout 45` recovery attempt failed because Docker processes did not stop before its deadline. No force reset, image prune, or volume deletion was attempted. The PR remained draft and tasks 4–5 remained In Progress until recovery; earlier passes did not substitute for the blocked gates.

## Final Phase 1 acceptance — 5 November 2026

The owner restored Docker. Verification resumed against implementation revision `6385547`; this follow-up changes documentation only, so no new behavioral red case applies.

- Docker 29.8.2 responded. `aspire start --non-interactive`, `aspire wait api --non-interactive`, and resource inspection reported application/identity databases, Keycloak, API, and web healthy; `keycloak-config` finished successfully without recreating users. The dashboard showed `tests` **Not started** at ordinary startup. Started it explicitly through Playwright MCP, inspected its console, and confirmed `exitCode: 0` through `aspire describe tests --format Json --non-interactive`: 22 Domain, 3 UseCases, and 65 API tests passed. Its environment contained only the Aspire certificate directory, with no developer database connection or JWT signing secret.
- The first resumed E2E attempt could not launch a browser because the pinned Chromium cache entry was missing. This is a dependency failure, not a behavioral failure. Ran `npx --prefix tests/PocketLedger.E2E playwright install chromium`, then `npm --prefix tests/PocketLedger.E2E test`: **2 passed (11.9 seconds)** with fresh disposable services, including the legacy default-flow regression and seeded provider login, stable local ID, owned 42.37 PLN spending, restart persistence, antiforgery rejection, scheme isolation, both-session logout, and revoked-cookie replay rejection. Assertions were unchanged.
- Playwright MCP completed real hosted login and logout against a separate disposable inspection stack. The native form posts to Keycloak's `/realms/pocketledger/login-actions/authenticate`; application login establishes the session without receiving the password. localStorage and sessionStorage were empty. After provider confirmation, preview `/api/auth/me` returned 401 and starting again required the password. Unknown email and wrong password produced the same generic error. Show/Hide preserved an accessible name and pressed state. Submission synchronously set `aria-busy=true`, disabled the submit button, and displayed “Logging in…”.
- MCP exercised session-check loading, a deliberately intercepted session-check 503, and keyboard-operated retry back to the real authenticated spending screen. These controlled responses prove UI presentation only; the retained E2E suite provides real authentication evidence. Reviewed screenshots of loading, recoverable error, spending, hosted login/error, and provider logout at phone/desktop sizes.
- Repeated the full hosted-login matrix from [note 014](014-mobile-layout-and-accessibility.md#verification-and-its-limits): ten viewports at 100% and 200% root text with reduced motion. All 20 cases had no horizontal overflow; control heights were at least 48 CSS pixels. Inspected the desktop, large/small phone, landscape, tablet, and short-viewport screenshots, including 200% reflow and separately enlarged provider logout. Tab order was email → password → Show/Hide → submit. Focus used the visible 3px outline, and the focused submit scrolled into the short viewport. Measured token contrast ratios: body 13.23:1, muted text 5.36:1, primary button 9.67:1, error text 6.42:1, field boundary 3.09:1.
- Completed the project-local UI/UX skill review for accessible authentication, text reflow, form feedback, touch targets, labels, focus, and the accepted light theme. No unresolved Phase 1 UI findings remain. Sanitized screenshots stay ignored under `output/playwright/keycloak-resumed-*.png`; protocol query strings, credentials, cookies, and inspection files are not published. Physical iPhone Safari, software-keyboard, and VoiceOver testing remain the explicit device limits described in note 014; desktop emulation does not prove those behaviors.

Source review found no remaining must-fix findings. Required frontend/tooling/format checks and committed-revision CI were already green and no source changed during this recovery. Both the pull-request and duplicate push workflows passed all four jobs on `6385547`. The follow-up commit records completion; verification-only Aspire and inspection services are stopped afterward, preserving application/identity volumes and unrelated local changes.

## Phase 2 continuation

Phase 1 behavior above remains historical evidence. [Learning note 017](017-registration-policy-and-concurrent-identity.md) records implemented registration policy, the provider build prerequisite, non-destructive retained-realm upgrades, and concurrency verification. Run `npm run build:keycloak-provider` alongside the existing theme build before starting current Aspire or E2E resources. Hosted registration parity and confirmation are still Phase 3; preview design-reference access and cutover remain later phases.
