# Authentication acceptance tests

Run from the repository root with Docker, the selected .NET SDK, and Node/npm available:

```sh
npm --prefix src/PocketLedger.Web ci
npm --prefix tests/PocketLedger.E2E ci
npx --prefix tests/PocketLedger.E2E playwright install chromium
npm run build:keycloak-provider
npm run build:keycloak-theme
npm --prefix tests/PocketLedger.E2E test
```

The harness owns disposable application PostgreSQL, identity PostgreSQL, and Keycloak containers, plus API and Vite processes on per-run ports. The frontend is copied to a test-owned directory with independently installed dependencies so Aspire’s developer install cannot remove files underneath the test server. Cleanup terminates the owned process groups, including npm/dotnet children. It imports the committed realm template with random test credentials and the packaged theme. No developer database, volume, key, or user is used. Application logs/keys stay under ignored `.artifacts/e2e`; browser test output stays under ignored `output/playwright/e2e`. Credential-step traces, screenshots, and video are disabled.

A token-protected loopback-only control endpoint belongs to the harness, not the product. The browser test uses it to stop/restart the API, then checks the same local identity, persistent session, and stored expense. Other coverage proves the sole cookie flow, rejection of former credentials, ignored historical selection headers, missing/tampered authentication, CSRF rejection, exact spending, and local/provider logout including replay of a revoked cookie.

For Playwright MCP inspection, use `E2E_INSPECT=1 npm --prefix tests/PocketLedger.E2E test`. After the tests the harness retains its disposable stack until SIGINT; ignored `.artifacts/e2e/inspection.json` contains transient test credentials, URL, and owner PID. Never publish that file. SIGINT closes owned processes/containers and deletes it. This mode is for local review; CI uses normal automatic cleanup.

`test:external` is an expert-only browser runner against an already prepared disposable stack with `E2E_*` settings and the restart control endpoint. Do not point it at the developer app. No password grant is used for application login: the suite fills real Keycloak hosted pages.

## Phase 2 registration and retained-realm upgrades

The default run imports current versioned policy. Repeat with `E2E_REALM_BASELINE=phase1 npm --prefix tests/PocketLedger.E2E test` to import the retained Phase 1 fixture (from `78fec1b`) and upgrade it through the same `configure-keycloak.mjs` used by Aspire. The default mode retains the full 31-test suite. The `phase1` mode selects only `upgrade.spec.ts`: two browser tests prove that seeded credentials and subject survive reconciliation, local account mapping stays stable, and a newly registered user can return with the same identity. Each harness run reconciles twice before browser login. CI runs this upgrade smoke only for identity/integration changes; unrelated PRs keep its check context through a success notice. No developer services are involved.

The registration suite retains a real OIDC transaction (state/nonce/PKCE) and opens Keycloak's supported `/protocol/openid-connect/registrations` endpoint. It submits email/password only, confirms creation, and continues through the real callback. It bypasses browser constraints for server-policy lengths 11/12/128/129 and covers trimmed/case variants, duplicate/concurrent registration, winning/rejected credentials, and owner-filtered CRUD/totals for two users. The harness-only `/identity-count` control counts exact normalized-email matches using authenticated administration; it never authenticates the application user.

All control actions require the per-run token on a loopback-only server. Do not expose that server, inspection credentials, or artifacts. The provider JAR is built with Docker against the pinned Keycloak version and mounted read-only into the disposable container. See learning note 017 for test-first evidence and policy design.

## Phase 3 hosted experience

`hosted-experience.spec.ts` covers actual mode-switch links, the two-field contract, generic login failure/focus, connected registration errors and editing, password-manager hints/pasted values, pending/repeated submission, confirmation before local-session issuance, continuation, forged provider action/email requests, provider-error recovery, and the full responsive/text/keyboard matrix. A harness-only `/require-confirmation` control assigns the action to an already-created disposable account to prove missing server creation notes fail closed. It targets only this harness's provider; no developer account is used. This exceptional negative fixture is not a normal registration or application-login shortcut.

The retained automated suite complements the required Playwright MCP screenshot/interaction review; it does not replace it. Sanitized visual evidence stays ignored. See learning note 018 and ADR 0016 for the provider presentation boundary, test corrections, and physical-device limits.

## Backend session-security coverage

`session-security.spec.ts` exercises single-use real callbacks, cancellation/correlation expiry, expired local sessions, provider HTTP 503 during new authentication and code exchange, local logout during an outage, real-provider wrong-PKCE and ID-token API rejection, and secret-free API logs/exported OTLP callback traces. A disposable HTTP proxy supplies provider faults; authenticated loopback controls affect only test-owned services/data. The existing suite retains successful registration/login/reload/restart/ownership/CSRF/tampering/logout coverage. No frontend production behavior is changed by this harness. See [learning note 019](../../docs/learning/019-session-security-and-failure-contracts.md).

## Phase 5 browser default

The retained suite now enters `/login` and `/register` through hosted Keycloak by default. `default-journey.spec.ts` proves confirmation, credential destination/storage, reload/revisit restoration, development-reference return/expiry, callback/provider/cancelled/expired-transaction recovery, Back/reload after logout, and expiry immediately before logout. `authentication.spec.ts` proves former credential endpoints return 404, alongside provider ownership/restart/tamper/replay evidence. The harness supplies no former JWT signing key. Cookie authentication works without a selection header. The former preview selector and frontend credential forms are removed intentionally; `/preview` remains a compatibility return destination.

The inspection file also contains the disposable control URL/token for intentional expiry/outage/restart checks through Playwright MCP. Treat all inspection data as sensitive. It is removed by harness cleanup and must never be published. Run inspection stacks sequentially because their ignored log/inspection locations are shared. See learning note 021 and ADR 0019.

## Phase 7 clean setup and full stack persistence

`persistence.spec.ts` registers two new owners through hosted forms, saves a different purchase for each, and records their provider subjects, local account IDs, exact stored purchases and separate disposable PostgreSQL volume IDs. The authenticated `/restart-stack` harness control stops API/Vite and **all three containers before starting any service again**. It restarts both databases and Keycloak using their retained storage, runs the ordinary startup import plus the same policy reconciliation as Aspire, then starts API and Vite at their original addresses. The test verifies session restoration and also clears cookies and signs in using each original password. Both provider subjects, local IDs, purchases, totals and cross-owner read/update/delete rejection must remain unchanged. The original application-volume configuration is unchanged.

The databases use distinct Docker-managed disposable volumes created by the PostgreSQL image; the test reads mount metadata and rejects the two developer volume names. Normal harness cleanup removes its containers and anonymous volumes. It does not connect to developer services or read their secrets. Restarting this test stack proves the acceptance behavior of the real services and committed bootstrap script; it does not substitute for the separate Aspire dashboard/lifecycle acceptance in issue #32.

To start with the committed user-free realm, after the dependency/provider/theme preparation above:

```sh
E2E_USER_FREE=1 npm --prefix tests/PocketLedger.E2E test persistence.spec.ts
```

This focused run imports no seeded users; both users must self-register. `E2E_USER_FREE` is for this focused setup test, since other retained tests intentionally require the seeded disposable account. For clean-checkout evidence, run preparation and this command from a fresh checkout/archive of the implementation revision, with no copied `.artifacts`, dependencies, credentials or build outputs. The normal full suite includes the persistence scenario. The retained-realm mode now runs only the focused upgrade smoke (see ADR 0023):

```sh
npm --prefix tests/PocketLedger.E2E test
E2E_REALM_BASELINE=phase1 npm --prefix tests/PocketLedger.E2E test
```

The loopback controls `/identity-subjects` and `/persistence-layout` return only test-owned identity IDs and storage metadata, never passwords or tickets. Persistence requires continuity of issuer/subject, databases, configuration/secrets and Data Protection keys. It is neither a tested backup/restore procedure nor an account migration. See [learning note 023](../../docs/learning/023-reproducibility-and-persistence.md).
