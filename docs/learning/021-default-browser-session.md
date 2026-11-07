# Default browser sessions and recovery

## The problem and the boundary

A token held in a React state variable disappears on reload. A server-side session lets the browser present an opaque HttpOnly cookie while the API verifies a protected PostgreSQL ticket. PocketLedger already delivered this in the preview; Phase 5 uses it for all browser entry points. The cookie’s 30-minute idle/eight-hour absolute bounds remain unchanged. Closing a browser does not explicitly log out; privacy settings can still remove cookies.

An alternative is storing bearer/provider tokens in browser storage, which adds credential custody and is unnecessary here. A separate BFF service could own sessions, but our existing API already provides that boundary. The cost here is a session lookup and carefully coordinated loading/recovery, rather than another deployed service. See [ADR 0019](../decisions/0019-default-browser-session.md).

## Application example

`App` calls `getSessionStatus` before mounting `TodayPage` or the lazy development `DesignSystemRoute`. An unavailable check renders retry and no private children; a rejected previously verified session renders an ended-session notice. First visits to `/login`, `/register` or a protected destination enter the hosted flow when no session exists. Hosted registration retains the verified provider confirmation and continues to today without a second password prompt.

The client still sends `X-PocketLedger-Auth: preview` to select the delivered cookie scheme. That header is not a credential. Phase 6 owns backend legacy removal and naming cleanup. No browser form submits passwords to `/api/auth/register` or `/api/auth/login`. Those backend endpoints intentionally remain temporarily testable over HTTP.

`history.state.pocketledgerVerified` is a non-secret marker, not authentication. It lets an expired reload display recovery rather than silently repeat login, but the API always verifies access. A new browsing history cannot distinguish an old expired cookie from a first visit and starts hosted login. Neither localStorage nor sessionStorage stores tokens or session state.

## Races and browser history

A pending verification can finish after logout. Abort controllers stop abandoned work; a verification epoch and suspended-session flag prevent a late success or periodic check from remounting private content after termination. Before a document enters history, the pagehide handler synchronously unmounts protected children. Pageshow checks access before restoration; terminal recovery remains usable on Back instead of becoming permanently stuck in a checking state.

This is distinct from HTTP `no-store`, which protects responses but does not clear an already rendered React tree. Both layers are needed. Polling every minute is bounded UI freshness, not instantaneous cross-device revocation.

## Recovery and logout

Phase 4’s JSON failures work for API consumers, but a top-level browser callback cannot be styled by a frontend that never loads. The owner approved a small bridge: HTML document failures redirect to `/auth/recovery` with only a bounded code and exact reference continuation. Other clients retain status/JSON. Recovery displays explicit actions and never repeats the failed transaction automatically. Unknown or inherited-property code strings fall back to generic copy; raw provider descriptions/state/code never enter the UI.

Logout hides content, gets a CSRF request token, and posts a native form so the browser can follow Keycloak sign-out. Review found a local-expiry race: the original authenticated token endpoint returned 401 before provider sign-out could start. With owner approval, a logout-only token endpoint and anonymous-but-CSRF-validated logout support that case. Named cookie authentication still revokes a valid ticket; forged anonymous logout remains rejected. Keycloak confirmation ends SSO, and provider outages can prevent remote completion. Failed initiation offers retry without displaying private data or claiming success.

## Test-first evidence

Base revision: `b3800b14a05fbcb3698ed1272e3c71d52bf3e78b`, freshly fetched `origin/main`. Branch: `codex/keycloak-default-browser`.

- `npm --prefix tests/PocketLedger.E2E test -- default-journey.spec.ts`: six real-service tests failed against the unmodified Phase 4 application. `/register` stayed on the first-party form, `/login` and `/design-system` stayed on legacy login, callbacks displayed JSON, and provider/cancelled transaction failures lacked recovery screens. These were behavioral failures after successful disposable Keycloak/API/PostgreSQL startup, not setup failures.
- `dotnet test tests/PocketLedger.Api.Tests --filter FullyQualifiedName~BrowserFailuresReturnOnlyBoundedCodeToRecoveryAsync --artifacts-path .artifacts/phase5-tests`: both new HTML bridge cases failed with the existing 400/503 JSON statuses instead of document recovery redirects. Existing JSON checks remained green after the bridge.
- The first implementation rerun passed five of six browser cases; registration exposed an incorrect `kc_action=register` entry. Switching to the supported registrations endpoint preserved the framework transaction and corrected the actual behavior. The assertion was retained.
- Full retained suite then passed all 29 journeys, including real registration boundaries/races, hosted interactions, confirmed creation, owner isolation, API restart, session restoration, both-session logout, callback replay/cancellation/correlation, provider HTTP faults, PKCE/token confusion and secret-free logs/telemetry.
- `ExpiredLocalSessionCanEndProviderSessionOnlyWithAntiforgeryAsync` failed against the original logout authorization with 401 instead of CSRF rejection/provider navigation. After the approved adjustment, all 19 security tests passed. A real-browser expiry-before-logout journey was added for regression coverage.

The old browser-default credential test was deliberately replaced with HTTP legacy-isolation assertions and the new hosted default registration journey. This reflects the authorized product change; ownership, restart, cookie tamper/replay, provider policy and backend credential-isolation assertions remain. The former frontend credential tests were removed with the unused forms; default session/recovery/history tests and real hosted form tests own the current observable behavior.

## Final verification

The frontend production build, lint and all 27 behavior tests pass. Full backend build/format verification passes with 22 Domain, five UseCases and 92 API tests (119 total); Docker-backed API tests apply real migrations. Both full disposable E2E modes passed all 30 retained journeys: current realm and `E2E_REALM_BASELINE=phase1`. After final lifecycle fixes, the seven affected default journeys passed again against the inspected stack with final frontend sources and a rebuilt API. Theme packaging passes; production inspection finds no reference-only copy/styles, preview selector or legacy credential endpoint calls.

Playwright MCP exercised real hosted registration/confirmation/continuation, returning login, reload, protected reference access, actual provider outage, cancelled/correlation-expired transactions with explicit successful retry, actual local session expiry, logout and Back/reload. It inspected empty browser storage; automated credential-request inspection proves passwords submit only to Keycloak. Controlled browser responses additionally exercised spending loading/error/retry/very-large totals; these visual fixtures do not substitute for the real-service suite.

The final screenshot review covers the complete note-014 matrix: 440×956, 430×932, 428×926, 414×896, 375×812, 320×568, 956×440, 768×1024, 1440×1000 and short 440×420, at 100% and 200% root text. Hosted login/register/confirmation, today, reference and each protocol recovery were captured and visually inspected in contact sheets; additional terminal/pending states were checked. No horizontal overflow or undersized controls was found. Touch-context password visibility and landscape scroll-to-submit passed; keyboard recovery actions had visible focus, reduced motion preserved usability, and dark system preference retained explicit light mode. Measured recovery contrast: heading 13.23:1, notice text 6.42:1 and action links 9.07:1. The hosted desktop baseline from Phase 3 was visually compared with the final screen; shared CSS/templates/mark retain the established appearance.

The independent code review found and led to fixes for registration entry, late/polled session restoration after logout, safe reference continuation, inherited recovery-code keys, terminal and public-recovery Back handling, and anonymous logout route-alias CSRF. Regression tests cover each lifecycle/security correction. The final review reports no unresolved important findings. The project-local UI/UX review applied accessible-authentication/error-recovery guidance and the product design guide; no unresolved findings remain. Store sanitized browser screenshots only under ignored `output/playwright/phase5`; inspection credentials/control tokens remain sensitive ignored artifacts and are never published.

## Exercises and limits

1. Why does an HttpOnly cookie not eliminate the need for CSRF protection? Explain the anonymous logout case.
2. Delay `/api/auth/me`, click Log out and then release the response. Which guard prevents the old response from restoring today’s total?
3. Navigate Back after an expired-session recovery. Why must pagehide preserve a usable terminal notice?
4. Compare a direct invalid callback with the same request from an HTTP client. Which information is safe to carry into a browser recovery URL?

Chromium emulation cannot prove physical iPhone Safari safe areas, real keyboard/autofill, browser chrome or VoiceOver. Complete the physical follow-up in note 014 separately. Backend production enablement, legacy retirement and final reproducibility/persistence acceptance remain later milestones. No developer data was used, reset or migrated.
