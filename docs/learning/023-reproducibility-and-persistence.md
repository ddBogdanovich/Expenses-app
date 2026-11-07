# Reproducible setup and full stack persistence

Phase 7 begins with issues [#30](https://github.com/ddBogdanovich/Expenses-app/issues/30) and [#31](https://github.com/ddBogdanovich/Expenses-app/issues/31). Final dashboard, integrated Playwright MCP/UI/UX acceptance, and the complete PRD audit remain separate issues #32–#34. This note does not mark the entire phase complete.

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
- Independent read-only review found no remaining Critical/Important/Minor implementation findings. Its merge recommendation remains conditional on the remaining execution evidence.
- Clean-source archive and full current/retained-realm results will be recorded after their runs finish. Until then, issues #30/#31 remain In Progress.

No product UI, authentication policy, schema, dependency or resource wiring changed. The new journey supplements the retained UI and security tests; it does not replace Playwright MCP review, Aspire dashboard acceptance, or a physical iPhone test. Phase 7's remaining acceptance work must keep its own evidence and unresolved findings visible.

Persistence is not a backup: a retained volume cannot recover deleted/corrupt data. This exercise does not test restoring backups, moving issuers, rotating client secrets, migrating accounts or changing Data Protection keys. Recreating the realm can change subjects and break ownership continuity even if the application volume survives. Follow [the existing cutover/backup procedure](022-credential-retirement.md#cutover-and-fresh-account-procedure); no developer reset or data deletion is performed here.

## Exercise

1. Why do two successful fresh password logins after restart prove more than restoring one cookie?
2. Which identity changes could create a new local account even when the email is unchanged?
3. Why must application and identity databases retain separate storage?
4. Design a separate backup/restore rehearsal: identify the databases, secrets, key ring and identity continuity checks it would require, without running a destructive reset.
