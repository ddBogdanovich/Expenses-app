# Plan: Keycloak authentication with PocketLedger UI preservation

**PRD:** [prd-keycloak-authentication.md](prd-keycloak-authentication.md)
**Date:** 2026-11-03

## Planning assumptions and delivery rules

- This plan authorizes no implementation or data deletion. Fresh accounts are acceptable; migrating existing accounts, passwords, and expenses is excluded. Preserve the existing `pocketledger-postgres-data` volume and document the cutover/reset procedure before any reset is performed.
- Use Keycloak-hosted credential pages and Authorization Code with PKCE. Plan around a backend-managed browser session so provider tokens remain server-side; record the final session mechanism, expiration settings, browser-close behavior, and theme tooling in the Phase 1 technical design/ADR before implementation. Valid sessions survive page reloads and revisits; indefinite sessions are not required.
- Phases 1–4 deliver an explicitly selected development preview alongside the working current flow. The two modes must have isolated authentication schemes and account resolution; credentials from one must not authenticate the other. Phase 5 makes Keycloak the browser default; Phase 6 removes the temporary legacy backend. No permanent dual-authentication product is planned.
- Phase 1 is the only phase that changes both frontend and backend. Later phases keep those implementation tasks separate; real-browser tests of a backend phase may use the already delivered UI without changing it.
- Every applicable phase follows a test-first end-to-end gate: write or extend executable acceptance tests, run them against the preceding phase's working state, record the expected behavioral failures, implement the phase, and rerun the same tests to green. Test/harness preparation is allowed before feature implementation; product code, configuration, migrations, and theme changes for the phase start only after this gate. Never count missing dependencies, an unavailable Docker runtime, broken fixtures, compilation errors, skipped tests, or unconditional failures as the expected red result. If necessary infrastructure is not yet available, record the test as blocked; verify the observable missing behavior through the running application where possible, then rerun the full journey as soon as its dependencies exist.
- Browser journeys require a repeatable automated real-browser E2E suite, introduced in Phase 1 and retained in the repository, in addition to the required Playwright MCP inspection. Use real Keycloak, API, and disposable PostgreSQL for authentication/ownership acceptance; mocks do not prove those journeys. Backend-only security/concurrency cases may use HTTP integration tests without changing the UI. Keep test-harness work distinct from product frontend changes when observing the phase layer boundaries.
- Preserve already-green regressions rather than manufacturing failures. For behavior already implemented by an earlier phase and for verification/documentation-only work, run the relevant tests first and record that they are already green, with the reason no new red case applies. Never weaken assertions, silently replace visual baselines, or skip a scenario to obtain green; correct a mistaken test only with a recorded explanation.
- Record each phase's red/green evidence in its focused learning note: scenario/test name, command, baseline revision or working-state identifier, expected and actual result, failure reason, and final passing run. Keep sanitized traces/screenshots in ignored test-output locations; do not store secrets or session material in documentation or artifacts. A phase is incomplete until its applicable E2E tests, earlier-phase regressions, and required checks pass. Blocked tests remain outstanding and are never reported as green.
- Each phase includes focused tests and documentation in its task budget. Code changes require the relevant build, behavior tests, and formatting checks. UI changes also require final Playwright MCP validation and project-local UI/UX review with no unresolved findings; use the complete [mobile/accessibility matrix](learning/014-mobile-layout-and-accessibility.md#verification-and-its-limits), not only desktop screenshots. If those tools are unavailable, the affected phase remains incomplete.
- AppHost changes require the repository Aspire skills and lifecycle verification: start from `PocketLedger.AppHost`, wait for affected resources, inspect logs, and stop verification-only sessions. Keep the dashboard test runner explicit-start and isolated from developer secrets.
- Update affected documentation in the same phase as each architecture change: README/diagrams, root/frontend instructions, domain descriptions, design guide/examples, relevant learning notes, and ADR status/links. Describe preview behavior as preview behavior; retain historical ADR rationale. Use the next available ADR number at implementation time (currently 0014), rather than reserving a number in this plan.

Criteria C1–C19 below refer to the PRD's Definition of done checkboxes in their existing order. “Covers” can identify partial progress; the coverage table identifies where each criterion is completed.

## Implementation phases

### Phase 1: Prove one branded login from browser to stored account

**Goal:** Deliver a selectable development preview where a seeded Keycloak user signs in, resolves to a persisted PocketLedger account, sees today's spending, and logs out. Existing registration/login remain usable while the new path is developed.
**Layers:** fe / be / db / infra
**Depends on:** none
**Covers:** C1, C7–C8, C10–C11, C13–C16, C18–C19 (initial slice).
**Test-first gate:** Before feature changes, introduce the isolated E2E harness and executable seeded-user login → local identity → owned spending → reload → logout journey, plus a regression for the current default flow. Run against the current application and record the expected missing preview entry/redirect/session behavior; unavailable future Keycloak infrastructure is a blocked full-journey run, not a red assertion. Capture the original UI as the reviewed visual reference. The fixture and full real-service journey must be executable and green by the end of this phase.
**Tasks:**

- [x] Write the technical design/ADR for session handling, realm/client boundaries, issuer/subject mapping, preview isolation, callback/return URLs, session expiration, and theme tooling. Capture baseline screenshots of current login, registration, and confirmation; document the fresh-account cutover before touching data. Update the affected architecture descriptions and add a focused learning note.
- [x] Add a pinned Keycloak Docker resource and persistent identity database through `PocketLedger.AppHost/AppHost.cs`, with secret parameters, readiness checks, and reproducible preview realm/client setup. Preserve the existing AppHost UserSecretsId, application volume, and explicit-start `tests` resource; do not reset existing data.
- [x] Add the smallest external-identity account creation/resolution behavior under `Domain/Accounts`, `UseCases/Authentication`, and Infrastructure persistence, with a versioned migration and unique issuer/subject mapping. Adapt `Infrastructure/Expenses/CurrentAccount.cs` to use the resolved local ID for the preview, retaining explicit expense owner filters and isolating legacy accounts without email-based linking.
- [x] Add preview start/callback/session-status/logout behavior in the authentication slices and API composition; connect a selectable preview in `Web/src/App.tsx` to today's spending using the chosen browser session. Add a PocketLedger-branded Keycloak login page based on existing account styles and assets, without a new design direction; credentials go only to Keycloak.
- [x] Complete the test-first isolated real-Keycloak/PostgreSQL fixture alongside `tests/PocketLedger.Api.Tests/AuthenticationDatabase.cs` and retained browser E2E suite; rerun login, stable local identity, owned daily total, reload, logout, and default-flow regressions to green. Document the repeatable test command, run affected backend/frontend checks, Playwright MCP and UI/UX review, and Aspire readiness/log verification; record the preview's limitations and red/green evidence.


**Definition of done:**

- [x] A seeded user completes branded redirect login, gets a persisted local GUID, sees their daily spending, reloads successfully, and logs out of both sessions. PocketLedger receives no password and browser storage contains no provider tokens.
- [x] Restarting the API retains the identity mapping; missing/invalid preview authentication cannot access expenses, and legacy credentials cannot authenticate the preview.
- [x] Existing default login/registration still pass their checks, and preview UI validation has no unresolved findings. The ADR, learning note, and affected current/preview documentation match the delivered slice.

### Phase 2: Establish registration policy and concurrent identity ownership

**Goal:** Make real Keycloak self-registration and local provisioning verifiable independently of the application UI, including policy boundaries and concurrent requests.
**Layers:** be / db / infra
**Depends on:** Phase 1
**Covers:** C2, C4, C10, C13, C16, C19.
**Test-first gate:** Before realm, provisioning, or schema changes, add and run real-service tests for email-only registration, password boundaries, normalized/concurrent duplicate email, repeated/concurrent local provisioning, two-owner isolation, and opaque subjects. Use supported browser registration/login for user journeys and HTTP integration tests for backend/concurrency cases. Record which assertions expose missing behavior and which already pass under Phase 1; rerun Phase 1 E2E regressions before and after the changes.
**Tasks:**

- [ ] Complete versioned realm/client configuration for email-only self-registration: trimmed, case-insensitive email identity; 12–128-character passwords; no required username/name/confirmation field; and no email verification, recovery, MFA, social login, or Direct Access Grants. Verify capabilities against the selected Keycloak version and isolate any necessary provider-side policy extension; do not recreate password handling in PocketLedger.
- [ ] Complete aggregate/repository and EF provisioning behavior so a newly authenticated issuer/subject resolves once to a local account, including repeated/concurrent first requests and database uniqueness conflicts. Avoid making mutable provider email the expense ownership key.
- [ ] Rerun the test-first real-Keycloak policy tests for password lengths 11/12/128/129, email whitespace/case variants, concurrent duplicate registration, and unchanged credentials after a rejected duplicate to green. Exercise supported browser authorization/registration endpoints with an isolated test client; do not use password grant as the test login shortcut.
- [ ] Rerun the test-first `PocketLedger.Api.Tests/ExpenseTests.cs` and authentication cases for two owners, foreign-ID NotFound, concurrent provisioning, and non-GUID provider subjects, plus earlier E2E regressions. Document reproducible realm setup, identity policy, red/green evidence, and the identity-boundary lesson; run backend checks and Aspire validation for changed configuration.

**Definition of done:**

- [ ] Tests against disposable real services demonstrate the policy boundaries, one identity per normalized email, and one local account per issuer/subject under concurrent provisioning.
- [ ] Owner-filtered CRUD and daily totals remain isolated for two users; issuer/subject identity never depends on parsing `sub` as a GUID or matching email to an old account.
- [ ] Realm setup is reproducible without manual reconstruction, and default/preview behavior remains usable.

### Phase 3: Preserve the full hosted login and registration experience

**Goal:** Make the preview's login, registration, and confirmation match the current product's appearance and interactions.
**Layers:** fe
**Depends on:** Phase 2
**Covers:** C3, C5–C6, C14–C16, C19.
**Test-first gate:** Before editing hosted forms/theme or confirmation UI, add browser E2E cases for login/register switching, email/password-only registration, confirmed account creation and continuation, duplicate/invalid input, generic login errors, password visibility, autocomplete/paste, pending/repeated submission, keyboard focus, and the responsive layout contract. Run against Phase 2 and record missing UI behavior. Compare to the reviewed original design; require explicit visual review of screenshot differences rather than automatically accepting the provider's current appearance as the new baseline.
**Tasks:**

- [ ] Complete the Keycloak theme using the Phase 1 tooling and the existing `AccountPage.tsx`, `Brand.tsx`, `styles/tokens.css`, and `index.css` as the design baseline. Preserve the desktop introduction, compact form-first policy, light/system-font theme, footer, shared mark, and safe-area behavior without a separately maintained palette.
- [ ] Adapt hosted email/password forms and login/registration links to Keycloak actions while retaining password visibility, accessible labels/errors, paste/autocomplete, pending feedback, duplicate-submit protection, and entered non-secret values on recoverable failures.
- [ ] Preserve the “You’re all set.” confirmation with the authenticated email and “View today’s spending” continuation. Ensure the confirmation follows verified successful registration, not a spoofable browser flag; do not add a second credential prompt or new profile fields.
- [ ] Rerun the test-first E2E/behavior coverage for invalid login, duplicate/invalid registration, success continuation, field editing, pending submissions, and password visibility to green, including earlier-phase regressions. Compare before/after screenshots through Playwright MCP at the full documented viewport/text matrix, complete the UI/UX review, fix findings, and rerun affected checks; record red/green evidence.
- [ ] Run frontend build/lint/tests and theme-specific build/checks required by the selected tooling. Update `docs/design/README.md`, applicable examples, frontend instructions, and the focused authentication/UI learning note to describe both application and hosted-page responsibilities.

**Definition of done:**

- [ ] A new preview user registers using email/password only, sees the preserved confirmation, and opens today's spending; returning login and duplicate registration have correct success/error outcomes.
- [ ] Final screenshots and interaction checks show no unresolved differences in the required brand, layout, hierarchy, responsive behavior, or accessibility. Unknown email and wrong password produce the same login failure message.
- [ ] The completed preview and the existing default flow both remain usable; frontend/theme checks pass.

### Phase 4: Complete backend session and callback failure handling

**Goal:** Make the backend authentication boundary ready for default use, including expiration, logout, hostile requests, and provider failures.
**Layers:** be / infra
**Depends on:** Phase 3
**Covers:** C7–C9, C13, C16, C19.
**Test-first gate:** Before backend session/security changes, add and run expiration, both-session logout, callback/state/replay, approved-return, forged-request, invalid-token, provider-outage, and secret-free logging cases. Use the existing browser for full login/session/logout journeys and HTTP integration tests for protocol/security boundaries. Assert backend failure contracts here; user-facing recovery presentation belongs to Phase 5. Record expected missing behavior and preserve earlier tests that already pass.
**Tasks:**

- [ ] Complete the authentication/session slices and Infrastructure policies for session restoration, bounded idle/absolute lifetime, provider renewal where selected, explicit logout, and protected-response caching. Keep API unauthorized responses distinguishable from browser login redirects.
- [ ] Complete callback-state/correlation/PKCE validation, approved return destinations, CSRF defenses for session-changing operations, and secure cookie/server-secret settings required by the selected session mechanism. Preserve the API `/api` route convention and existing thin-controller boundaries.
- [ ] Define stable responses for unavailable Keycloak, cancelled/failed callbacks, expired transactions, and invalid sessions so the frontend can offer recovery without redirect loops. Exclude credentials, tokens, cookies, and client secrets from logs and telemetry.
- [ ] Rerun the test-first isolated security tests for missing/expired/tampered/wrong-issuer/wrong-audience credentials, ID tokens presented as API credentials, replay/invalid callback state, unapproved redirects, forged session changes, and logout to green, plus earlier E2E regressions. Exercise provider outage and expired sessions without changing frontend behavior in this phase; record red/green evidence.
- [ ] Run relevant backend checks and Aspire verification; document session policy, failure responses, HTTPS/local-development differences, and the session-security learning exercise in affected documentation.

**Definition of done:**

- [ ] Independent HTTP/integration tests prove session expiration and both-session logout, reject invalid credentials/redirects/forged requests, and demonstrate bounded recovery responses for each specified provider/callback failure.
- [ ] Captured logs contain no sensitive authentication values, and existing preview browser login/registration remain functional.

### Phase 5: Make the Keycloak journey the default browser experience

**Goal:** Deliver the complete user-facing migration, including session restoration, recovery states, logout behavior, and the protected design reference.
**Layers:** fe
**Depends on:** Phase 4
**Covers:** C3, C5–C9, C12 (browser evidence), C14–C17, C19.
**Test-first gate:** Before changing default browser routes or session consumers, add and run E2E tests for `/login` and `/register` entering Keycloak by default, registration confirmation, reload/revisit restoration, development-reference return, expiration, logout followed by Back/reload, and recoverable provider/callback/transaction failures. Run against Phase 4's preview/default split and record the expected failures in default routing and presentation. Keep previously passing preview journeys as regressions until default equivalents pass; do not replace assertions merely to conceal a broken path.
**Tasks:**

- [ ] Replace the in-memory bearer-token flow in `Web/src/App.tsx`, `features/authentication/auth-api.ts`, and `features/today/today-api.ts` with the delivered session contract. Make `/login` and `/register` enter the hosted flow by default, remove the temporary preview selector, and preserve safe continuation to `/` or the development design reference.
- [ ] Adapt `TodayPage.tsx`, `design-system/DesignSystemRoute.tsx`, and their callers to restore/verify sessions before displaying protected content; keep `/design-system` development-only and excluded from production output.
- [ ] Implement the backend's provider-unavailable, callback cancellation/failure, expired transaction, and expired-session states using existing presentation patterns. Ensure logout clears protected content and browser Back does not reveal cached expense information; keep retry/return actions accessible.
- [ ] Rerun the test-first default-journey E2E suite to green and update obsolete credential/token unit tests to observable session/redirect tests in `App.test.tsx`, authentication tests, and design-system tests. Exercise real registration/login/reload/revisit/logout plus every new failure state through Playwright MCP, inspect network/storage, complete the full screenshot/accessibility matrix and UI/UX review, and rerun checks after fixes; record red/green evidence.
- [ ] Run frontend build/lint/behavior tests and the theme checks; update frontend instructions, design guidance/examples, README user journeys, and relevant learning notes to identify Keycloak as the default while recording the pending legacy backend removal.

**Definition of done:**

- [ ] Default browser entry points deliver registration confirmation, login, valid-session restoration, expiration recovery, and complete logout. Failure recovery has no infinite redirects, false authentication, or indefinite loading state.
- [ ] Browser Back/reload after logout do not restore protected content; design-reference access/return work only in development, and production build inspection confirms its exclusion.
- [ ] Network inspection shows password submission only to Keycloak and no provider tokens in localStorage/sessionStorage. Final UI review has no unresolved findings and frontend/theme checks pass.

### Phase 6: Retire first-party credentials and complete backend cutover

**Goal:** Remove temporary dual authentication and the old signing-key requirement, leaving Keycloak as the sole credential authority.
**Layers:** be / db / infra
**Depends on:** Phase 5
**Covers:** C12–C13, C16, C18–C19.
**Test-first gate:** Before removing legacy code/configuration/schema, add and run acceptance tests proving old credential endpoints cannot issue tokens, old first-party tokens are rejected, startup needs no former signing key, and the current model/schema has no password verifier. Run against Phase 5 with its temporary legacy backend and record the expected failures; rejection cases already green remain regression evidence. Run default Keycloak browser journeys before and after cutover, including login, owned expense access, reload, logout, and no silent reset of disposable data.
**Tasks:**

- [ ] Remove the legacy register/login credential controllers and handlers, password/token ports, `PasswordService`, `JwtTokenIssuer`, and old `JwtSettings` registration. Retain/adapt the current-account/session contract; remove legacy authentication selection and reject former first-party JWTs.
- [ ] Remove password-verifier state from `Domain/Accounts/UserAccount.cs` and its EF mapping through a new reviewed migration; retain historical migration files. Finalize the new-account boundary and describe exactly how existing unmigrated accounts/expenses are retained, archived, or explicitly reset under the documented fresh-start procedure, preserving the application volume and avoiding startup data deletion.
- [ ] Remove the `jwt-signing-key` parameter and `Jwt__SigningKey` injection from AppHost while retaining its UserSecretsId and all unrelated secrets. Keep secrets required by the chosen provider/session integration outside source; do not delete unrelated user-secret entries.
- [ ] Rerun the test-first retirement/startup/schema acceptance tests and default Keycloak E2E journeys to green; replace obsolete API credential tests and `.http` examples with supported scenarios while retaining restart, registration-race, ownership, and invalid-token behavioral coverage using real disposable services. Record red/green evidence for endpoint/token retirement and signing-key/schema removal.
- [ ] Run backend build/tests/format checks and Aspire lifecycle verification. Update architecture diagrams, README/setup, root instructions, domain identity documentation, superseded ADR links, and learning notes so none describe removed authentication as current.

**Definition of done:**

- [ ] The working default browser flow uses the sole remaining authentication path. Old credential requests cannot issue tokens and old first-party tokens cannot access protected endpoints.
- [ ] The current schema/model has no PocketLedger password-verifier storage, startup needs no old JWT secret, and migrations/reset procedures do not silently delete account or expense data.
- [ ] Backend checks pass against real disposable services; documentation distinguishes historical implementations from the completed cutover.

### Phase 7: Verify reproducibility, persistence, and final PRD coverage

**Goal:** Prove the completed milestone can be set up and restarted from documented instructions, and collect final acceptance evidence.
**Layers:** infra
**Depends on:** Phase 6
**Covers:** C1–C2, C11, C14–C16, C18–C19; final audit of C1–C19.
**Test-first gate:** Before infrastructure/setup fixes, define or extend executable clean-setup and stop/restart journeys, and run the full retained E2E suite against Phase 6 using disposable resources. Include registration, stable local identity, owned expenses, and data survival without manual realm reconstruction. If all criteria are already green, record a verification-only baseline and keep it green; do not invent a failure. Any discovered setup defect needs a reproducing failing acceptance test before its fix, followed by the same scenario passing.
**Tasks:**

- [ ] Validate clean-checkout setup with disposable volumes/secrets: reproduce realm/client/theme configuration, register two users, and access owned application data without manually rebuilding provider settings. Fix infrastructure/setup gaps and verify imports never overwrite existing users during ordinary startup.
- [ ] Stop/restart the local stack and verify Keycloak identities, local account GUIDs, expenses, and ownership remain intact. Confirm the named application volume is retained and identity persistence is independent; record that persistence is not a backup or an account-migration guarantee.
- [ ] Run the final frontend checks, full backend suite/formatting, and CI-equivalent checks affected by the change. Start the dashboard `tests` resource explicitly, inspect exit code/logs, and prove it remains inactive at normal startup and receives no development connection/signing secrets.
- [ ] Repeat final Playwright MCP and UI/UX acceptance against the integrated default stack, including the entire documented browser matrix, real registration/login/logout, session/callback/provider-error states, before/after visual comparisons, and network/storage checks. Record physical iPhone verification limits separately; return any implementation fixes to their owning frontend/backend phase and repeat affected checks.
- [ ] Audit all 19 PRD criteria and each phase's test-first evidence, including justified already-green/not-applicable cases; review README, root/frontend instructions, domain/design descriptions, diagrams, learning notes/exercises, ADR links, setup, reset, and repeatable E2E commands for consistency. Leave no unresolved acceptance finding and stop verification-only resources.

**Definition of done:**

- [ ] Clean setup and restart exercises pass without developer data or manually reconstructed realm settings; normal startup preserves new identities and expenses.
- [ ] Required checks and the explicit dashboard test run pass; final Playwright MCP and UI/UX reviews have no unresolved issues, with any physical-device limitations stated.
- [ ] Every PRD criterion has evidence, documentation and links match the final implementation, and no temporary legacy authentication remains.

## PRD coverage

| Criterion | Acceptance requirement | Completed in phase(s) |
| --- | --- | --- |
| C1 | Aspire readiness/logs; explicit-start tests | 1, 7 |
| C2 | Reproducible setup; no committed secrets | 2, 7 |
| C3 | Email/password-only registration and confirmation | 3, 5 |
| C4 | Password/email rules against Keycloak | 2 |
| C5 | Successful login and actionable, non-enumerating errors | 3, 5 |
| C6 | Hosted form interaction parity | 3 |
| C7 | Session restoration and expiration | 4, 5 |
| C8 | Application/provider logout and Back/reload behavior | 4, 5 |
| C9 | Provider/callback/transaction failure recovery | 4, 5 |
| C10 | Owner isolation; stable, concurrent provisioning | 2 |
| C11 | Identity and expense restart persistence | 7 |
| C12 | Passwords only to Keycloak; old endpoints/tokens/key retired | 5, 6 |
| C13 | Session/API security and secret-free logs/storage | 4, 5, 6 |
| C14 | Before/after UI preservation review | 3, 5, 7 |
| C15 | Complete Playwright MCP/UI/UX matrix | 3, 5, 7 |
| C16 | Frontend/backend/real-service verification | 2–7 |
| C17 | Protected, development-only design reference | 5 |
| C18 | Explicit, non-destructive fresh-start procedure | 1, 6, 7 |
| C19 | Current documentation, learning notes, ADR history | 1–7 |
