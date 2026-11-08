# Reproducible setup and full stack persistence

Phase 7 completes local acceptance for issues [#30](https://github.com/ddBogdanovich/Expenses-app/issues/30)–[#34](https://github.com/ddBogdanovich/Expenses-app/issues/34): clean setup, full restart, dashboard tests, integrated browser/UI review and all 19 PRD criteria. Production deployment and physical iPhone verification remain outside the completed browser-emulation evidence.

## What the new journey proves

Reproducibility means that versioned configuration and documented preparation can create a working installation without copying a developer's hidden state. Persistence means existing identity and expense data survive stopping the services that use them. These are separate properties: rebuilding configuration successfully does not prove that a returning user still owns yesterday's purchases.

`tests/PocketLedger.E2E/specs/persistence.spec.ts` registers two fresh users through the actual hosted forms and records their Keycloak subjects, resolved local account GUIDs, exact purchases and independent database volume IDs. A harness-only authenticated loopback control stops API, Vite, Keycloak and both PostgreSQL containers before restarting any of them. Startup reruns Keycloak's ordinary import and the same non-destructive policy reconciliation as Aspire. The unchanged issuer address, runtime credentials, database volumes and Data Protection key ring are retained.

The test first restores existing cookie sessions, then clears all cookies and requires each original password again. This prevents a cached cookie from being mistaken for proof that provider users and credentials survived. Provider subjects and local account IDs must remain exactly equal. Each owner sees only their own purchase and exact total, while foreign GET/PUT/DELETE requests remain 404. Final reads prove rejected writes did not damage either owner's data.

PostgreSQL's image creates a separate disposable Docker volume for each database. The harness verifies volume mounts, distinct IDs, and unchanged IDs after restart, rejecting the developer volume names. Cleanup removes only test-owned containers/anonymous volumes. The application still names `pocketledger-postgres-data`, and identity storage still names `pocketledger-identity-postgres-data`; AppHost wiring and UserSecretsId are unchanged. Developer volumes and credentials are not used by the acceptance suite.

The database health check uses `pg_isready` over TCP for the configured database. A Unix-socket check can pass during PostgreSQL's temporary initialization server, before its final network listener starts. Independent review identified that race; requiring TCP readiness fixes the harness without changing product behavior.

## Repeatable commands

From a fresh checkout/archive, install dependencies and build the provider and shared theme as described in [the E2E guide](../../tests/PocketLedger.E2E/README.md). Then run:

```sh
E2E_USER_FREE=1 npm --prefix tests/PocketLedger.E2E test persistence.spec.ts
npm --prefix tests/PocketLedger.E2E test
E2E_REALM_BASELINE=phase1 npm --prefix tests/PocketLedger.E2E test
```

The first command imports no seeded users: both owners must self-register. The retained suite intentionally seeds a disposable account for its other authentication/security cases, so `E2E_USER_FREE` applies only to the focused setup run. The upgrade run starts from the retained Phase 1 realm and uses the same versioned reconciliation. It also reruns the full restart journey.

## Evidence and scope

Baseline: freshly fetched `origin/main`, `8eb951a3d58505748e14421f748a19fc30b8f89c`, on `codex/phase-7-acceptance`.

- Before harness extensions, the complete retained real-service suite passed **30 tests (29.0 seconds)**. This is verification of already-implemented behavior, so no manufactured product failure or infrastructure fix is required.
- `npm test`: **23 passed**.
- `npm run check:frontend`: lint, strict TypeScript/production build and **27 behavior tests passed**.
- `npm run check:backend`: restore/build with **zero warnings/errors**, **24 Domain / 5 UseCases / 81 API tests passed**, and formatting passed.
- The first extended run reported **17 passed / 14 failed**: the restart control used stale ephemeral Docker ports and failed reconciliation with 503; subsequent cases then encountered the stopped web server. This is a harness-preparation defect, not a product behavioral red result. Refreshing both mapped ports after restart fixes it. An existing pending-submission test separately timed out on its second DOM evaluation behind deliberately held document navigation; combining the repeated submission and pending-state read in the same DOM turn retains the original assertions without that scheduling race.
- After those corrections, `E2E_USER_FREE=1 npm --prefix tests/PocketLedger.E2E test persistence.spec.ts`: **1 passed (20.6 seconds)**, including fresh registration and full restart.
- Exported committed implementation `ceb7d16fcca973268d063cf6f64957a770c81120` with `git archive HEAD` into an empty temporary directory. No dependencies, build outputs, key ring, `.artifacts`, user secrets or developer configuration were copied. Ran root/frontend/E2E `npm ci`, pinned Chromium preparation, provider build, shared-theme build and the documented user-free focused command there: **1 passed (19.5 seconds)**. API has no UserSecretsId and the harness supplies fresh random runtime secrets, a private per-run key ring and disposable databases. Docker image/package caches may be reused; this is a clean source/dependency install, not an offline or empty-cache installation test.
- Full current realm suite: **31 passed (1.1 minutes)**. Full `E2E_REALM_BASELINE=phase1` suite: **31 passed (46.6 seconds)**. Both include the new full-stack restart and all previous registration/security/ownership regressions. No product code/configuration/schema/theme changes were needed.
- Independent read-only review found no remaining Critical/Important/Minor implementation findings after the readiness and port-rebinding corrections. Final acceptance documentation received a separate completion review.
- `aspire start --non-interactive`, `aspire wait api --non-interactive` and `aspire wait web --non-interactive` succeeded. `keycloak-config` completed without replacing users. MCP observed **Not started** for `tests` at normal startup, selected its **Start** action and inspected its console: **24 Domain / 5 UseCases / 81 API** passed. `aspire describe tests --format Json --non-interactive` reported **Finished, exitCode 0**, repository-root working directory, `.artifacts/tests` build output, no relationships and only `SSL_CERT_DIR` in its environment. No development connection/signing secrets were supplied. `aspire stop --non-interactive` stopped this verification-only session.
- The disposable MCP inspection stack reran the focused restart journey: **1 passed (23.1 seconds)**, then remained available for browser review. It was stopped with its own recorded PID/SIGINT, and cleanup removed the inspection credentials/key ring/frontend copy and test containers. Existing developer volume names and creation dates were unchanged before/after; AppHost source and UserSecretsId are identical to the base revision.
- Root tooling, frontend/backend checks and hygiene passed. Source whitespace and local Markdown links were reviewed. Production output inspection found no design-reference marker/copy or reference module. Committed-revision coverage and hosted CI are additionally enforced on publication; their current state is visible in the implementation PR.

No product UI, authentication policy, schema, dependency or resource wiring changed. The new journey supplements the retained UI/security tests and the separately completed Playwright MCP and Aspire acceptance below. No new ADR is needed for test-harness additions; ADRs 0014–0020 remain the accepted authentication design and supersession history.

Persistence is not a backup: a retained volume cannot recover deleted/corrupt data. This exercise does not test restoring backups, moving issuers, rotating client secrets, migrating accounts or changing Data Protection keys. Recreating the realm can change subjects and break ownership continuity even if the application volume survives. Follow [the existing cutover/backup procedure](022-credential-retirement.md#cutover-and-fresh-account-procedure); no developer reset or data deletion is performed here.


## Final integrated browser and UI/UX review

Playwright MCP reviewed the real disposable integrated default stack. Login, registration, trusted confirmation, today, protected reference, logged-out, cancelled, transaction-expired, callback-failed, provider-unavailable, session-expired, checking, verification-unavailable, logout-failed, spending-loading, spending-error and very-large-spending states each have 20 captures: all ten note-014 viewports at 100%/200% root text. Reduced motion and a dark device preference were active while the explicit light theme remained intact. All **340 matrix captures** had one h1, no horizontal page overflow, and no visible button/input under 48 CSS pixels; controls grow with enlarged text. Screenshots/contact sheets were visually inspected, including the narrow phone and enlarged tablet/landscape layouts. The original pre-migration and Phase 3 desktop login/register/confirmation screenshots were compared with the final three screens: brand, palette, typography, composition and form-first compact hierarchy remain consistent.

MCP completed actual registration/confirmation/continuation, reload, protected-reference access, both-session logout, Back/reload denial, fresh password prompt and empty localStorage/sessionStorage. Credential-request observation recorded only the provider registration action, never a PocketLedger credential endpoint. A separate touch context exercised password visibility, generic unknown/wrong-password equality, duplicate registration recovery and pending/repeated submission: busy state, disabled action, pending label and one credential POST remained correct. Keyboard order was email → password → Show/Hide → submit. A 3px focus outline was visible and the focused submit scrolled into the short enlarged viewport. Password-manager hints/paste remain covered by the retained hosted-experience test. No real password or provider token is included in the published evidence.

Real provider 503 faults, real cancelled/expired correlation transactions, invalid callbacks and actual database ticket expiry exercised recovery. Cancelled/expired paths returned local 401, never displayed raw provider descriptions, and their explicit retry restored spending through valid provider SSO. Provider outage stayed stable across reload, then retry returned to the password form after recovery. An initial inspection incorrectly expected a password prompt on retry despite still-valid provider SSO; this was an inspection assumption, corrected without changing product behavior. Another inspection attempt lacked local-network permission, and a delayed-route cleanup caused a handled-route error; both were tool/fixture errors, corrected and rerun successfully, not behavioral red evidence.

Controlled browser HTTP fixtures separately exercised session-check loading/unavailability/retry, logout-initiation failure with private content hidden, spending loading/error/retry and exact large integer formatting (`9 007 199 254 740 991,99 zł`). They prove presentation, not provider/database correctness. All routes were removed, and final real-stack reload showed today with empty browser storage and no failure notice. Measured contrast ratios: body **13.23:1**, muted/background **5.02:1**, primary **9.67:1**, error **6.42:1**, field boundary **3.09:1**, focus **5.45:1**. The project-local UI/UX review checked accessible authentication, labels, connected errors, focus, feedback, touch targets, reflow, reduced motion and the accepted light design. No unresolved browser/UI findings remain.

Sanitized captures stay ignored under `output/playwright/phase7`; protocol queries, tickets, secrets and inspection files are not published. Physical iPhone Safari, browser chrome, hardware safe areas, actual software keyboard/autofill and VoiceOver remain the explicit follow-up limits in note 014. Chromium touch emulation is not evidence that those physical checks ran.

## Final PRD evidence audit

Criteria retain the PRD checkbox order. All refer to the local Development/Testing milestone, not production enablement.

| Criterion | Evidence |
| --- | --- |
| C1 — Aspire readiness and explicit tests | Phase 7 healthy API/web, successful configuration, MCP dashboard NotStarted → explicit Start → exit 0; environment inspection above. |
| C2 — Reproducible setup, external secrets | User-free clean-source archive run above; random test secrets, versioned realm/provider/theme, configuration idempotency tests and secret scan. |
| C3 — Two-field registration and confirmation | `default-journey`/`hosted-experience` suites; MCP real registration, trusted confirmation and continuation without another prompt. |
| C4 — Password/email policy | `registration-policy` suite: 11/12/128/129, whitespace/case duplicates and concurrent winners, both realm baselines. |
| C5 — Login and non-enumerating errors | Seeded/default journeys plus unknown/wrong-password equality, duplicate corrections; repeated MCP touch review. |
| C6 — Hosted interactions | Hosted mode switch, visibility, autocomplete/paste, connected errors, pending/one POST; MCP keyboard and touch checks. |
| C7 — Restore and expiry | Reload/revisit tests, bounded server-ticket API cases, real MCP local expiry and explicit recovery. |
| C8 — Both-session logout and history | Default/session suites, revoked-cookie replay, MCP provider confirmation, Back/reload 401 and fresh password form. |
| C9 — Recoverable failures | Real provider HTTP faults, cancellation/correlation expiry and callback failure tests/MCP; stable retry with no raw descriptions. |
| C10 — Ownership and concurrency | Two-owner CRUD/totals E2E, concurrent identity API tests, opaque subject/issuer tests; full restart repeats isolation. |
| C11 — Full restart persistence | New `persistence.spec.ts`, exact subjects/GUIDs/password login/sessions/expenses/independent volumes before and after all-service stop/restart. |
| C12 — Credential retirement | `CredentialRetirementTests`, old endpoints 404/token rejection/schema/startup tests, no JWT key in harness/AppHost; MCP provider-only credential POST. |
| C13 — Security and secret-free capture | Antiforgery, tamper/replay, invalid issuer/audience/ID-token/PKCE/redirect tests; real OTLP/log audit in both suites and empty MCP browser storage. |
| C14 — Visual preservation | Original → Phase 3 → final login/register/confirmation comparison, 340 final matrix captures and interaction-state review. |
| C15 — MCP/UI review | Complete note-014 matrix, touch/keyboard/focus/contrast/reduced motion/light theme checks above; physical-device limits stated separately. |
| C16 — Required checks and real services | 23 tooling, 27 frontend, 24 Domain/5 UseCases/81 API, build/format, provider/theme, both 31-test real-service suites and dashboard pass. |
| C17 — Protected development reference | Default journey tests, MCP verified reference/reload; production build contains no reference module or unique reference copy. |
| C18 — Explicit non-destructive cutover | ADR 0020/note 022 backup/fresh-account procedure; unchanged named volumes/secrets/owners, no reset or migration by email. |
| C19 — Current documentation and ADR history | README/root/frontend/domain/design/E2E/PRD/plan reviewed and status aligned; notes 016–022 preserve history, ADR supersession links retained. |

## Test-first audit across the seven phases

| Phase | Baseline and gate record | Final interpretation |
| --- | --- | --- |
| 1 | Note 016: `d233787`; legacy journey green, new preview missing-link failure; missing browser/runtime interruptions excluded from red. | Preview green and recovered dashboard/MCP acceptance recorded; original screenshots retained. |
| 2 | Note 017: existing concurrent provisioning already green; seven real registration cases failed with registration disabled before provider changes. | Both fresh/retained realms green; documented fixture corrections do not remove ownership/credential assertions. |
| 3 | Note 018: hosted parity tests exposed inherited fields, confirmation/interaction/presentation gaps before theme changes. | Native hosted experience/confirmed creation green; approved narrow provider support in ADR 0016, full visual matrix recorded. |
| 4 | Note 019: `547e026`; 11 expected failures/5 already-green HTTP cases, with real-provider missing-cache behavior reproduced; initial PAR/fixture errors excluded. | Bounded session/callback/provider contracts green; instrumentation fixture replaced with real OTLP evidence, not counted as product red. |
| 5 | Note 021: six default-browser failures against `b3800b1`, HTML bridge failures, expiry-before-logout failure. | Default routing/recovery/history green; explicit narrow backend approval in ADR 0019 and regression coverage preserved. |
| 6 | Note 022: `4b8e450`; 5 expected retirement failures/5 already green cases; 30-browser baseline green. | Credential/schema/key retirement green; persistence, downgrade refusal and coverage regressions handled without weakening gates. |
| 7 | This note: `8eb951a`, existing 30-browser baseline green; new verification-only journey and clean archive. | No product behavior fix or manufactured red; readiness/port/inspection fixture defects explicitly excluded from behavioral red. |

Documentation review keeps setup and reset separate, preserves historical rationale and deployed-path compatibility, and describes messaging/Kubernetes/allowance/production hosting as planned. No new architecture or domain rule was introduced. There are no unresolved local milestone acceptance findings.

## Exercise

1. Why do two successful fresh password logins after restart prove more than restoring one cookie?
2. Which identity changes could create a new local account even when the email is unchanged?
3. Why must application and identity databases retain separate storage?
4. Design a separate backup/restore rehearsal: identify the databases, secrets, key ring and identity continuity checks it would require, without running a destructive reset.
