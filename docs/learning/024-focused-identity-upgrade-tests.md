# Focused identity upgrade acceptance

A test matrix varies a starting condition. PocketLedger's `current` and `phase1` labels describe realm policy fixtures, not Keycloak software versions. Both use the same pinned provider image. Previously both executed the same full browser suite.

The current suite remains responsible for all 31 existing scenarios, including security, responsive hosted forms, ownership and persistence. The two tests in `upgrade.spec.ts` answer narrower questions: can an existing user still log in with the same subject and local account after policy reconciliation, and can a newly registered user log in again with stable identity? The disposable harness applies the production reconciliation script twice before either browser test, retaining an idempotence check.

## Selecting useful work

`scripts/checks.mjs ci-scope` emits separate `run_application_checks` and `run_upgrade_checks` flags. Full PR diffs decide the PR scope; main uses its before/after range. Identity dependencies select the upgrade smoke. Frontend changes select it conservatively because provider styling is packaged from frontend assets. Persistence changes select it because account/session storage participates in login. `Infrastructure/Expenses/CurrentAccount.cs` is included explicitly: folder names alone do not reveal its authentication responsibility.

The workflow keeps both matrix names. A phase1 success notice means no relevant dependency changed, while an executed phase1 run means the upgrade smoke passed. The default/current suite still runs for ordinary PRs and main; existing docs-only PR and feature-push rules remain. Missing comparison history requests more testing.

## Verification

The new scope-output assertion failed before implementation. It then passed alongside tests for unrelated Money/docs changes, relevant realm/CurrentAccount changes, main ranges, unknown baselines and feature pushes. The tooling suite passed all 29 tests. Playwright listing confirmed 31 tests across six files in current mode and two tests in one file in phase1 mode. Both focused browser tests passed against real disposable Keycloak/PostgreSQL/API/Vite services; cleanup completed normally. No application UI changed in this task.

The full current suite is retained for CI; the focused local run does not claim a fresh pass of those 31 tests. Earlier persistence evidence in [note 023](023-reproducibility-and-persistence.md) remains historical evidence of the previous broader matrix.

## Exercise

Imagine moving `CurrentAccount` into a new folder. Which CI regression would catch a lost dependency? Add that regression before changing the selector. Then consider whether a pure expense validation change needs old-realm reconciliation acceptance or is already covered by the current full suite.

See [ADR 0023](../decisions/0023-focused-identity-upgrade-acceptance.md).
