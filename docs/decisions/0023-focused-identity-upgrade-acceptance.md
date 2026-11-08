# ADR 0023: Focus retained-realm acceptance on upgrade behavior

- Status: Accepted
- Date: 2026-11-08
- Refines the authentication matrix policy in [ADR 0022](0022-pr-centered-verification.md).

## Context

The current and phase1 CI variants used the same Keycloak version and full browser suite, differing only in their starting realm configuration. Repeating every responsive, security, persistence and ownership scenario against an old policy fixture adds cost without isolating the upgrade contract.

## Decision

Keep all 31 existing browser tests in the default/current mode. Select only `upgrade.spec.ts` when `E2E_REALM_BASELINE=phase1`: two real browser tests verify retained credentials, unchanged provider subject and local account mapping, followed by new registration and returning-user login. The harness still imports the old fixture with a seeded identity and applies production reconciliation twice before login. No password grant or developer service is involved.

CI computes a separate upgrade flag from the complete PR three-dot diff or main push before/after diff. Identity configuration, provider/theme builds, account/authentication/persistence integration, `CurrentAccount`, API/service defaults/AppHost, frontend, E2E/API tests, workflow and shared dependency/build configuration changes select it. Frontend and persistence paths are deliberately broad because hosted assets and account/session storage cross those boundaries. Pure expense/domain changes do not select it. Missing comparison objects, tags and unknown events conservatively select both suites. Feature pushes remain hygiene-only.

Keep the existing `authentication-e2e (phase1)` context. When upgrade testing is unnecessary, it reports a lightweight notice without installing dependencies or starting services. No required-check settings change.

## Consequences

PR/main runs retain full current-policy acceptance while upgrade coverage has a distinct purpose. Historical Phase 7 evidence ran persistence in both modes; ongoing full-stack restart coverage now lives in the current suite. The focused smoke does not prove every historical policy combination or a Keycloak version upgrade. New identity dependencies must be added to the selector, with a regression; unavailable Git baselines fail toward additional testing.

Manual preparation and commands remain in the [E2E guide](../../tests/PocketLedger.E2E/README.md). See [learning note 024](../learning/024-focused-identity-upgrade-tests.md) for verification and an exercise.
