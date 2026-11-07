# ADR 0016: Confirm registration inside the provider transaction

- Status: Accepted
- Date: 2026-11-07
- Supplements [ADR 0015](0015-keycloak-registration-policy.md) and [ADR 0014](0014-keycloak-development-preview.md).

## Context

Phase 3 preserves the hosted account forms and “You’re all set.” confirmation. The existing callback supplies no registration result or authenticated email to the frontend. A browser query flag or remembered form input cannot establish successful account creation. The owner explicitly authorized narrow backend support for this requirement despite the phase's original frontend-only boundary.

## Decision

Keep confirmation in native Keycloak presentation. After the registration action actually creates the user, it records that user's ID in an authentication-session note and assigns `pocketledger-registration-confirmation` to that transaction. The required action checks that note against the authenticated user before displaying the stored email and again before accepting continuation. It removes the note on completion. Application-initiated invocation is unsupported, and the action is never a realm default or assigned to existing accounts by ordinary configuration.

The confirmation means that a provider account was created. It does not mean email ownership was verified; email verification remains disabled in this preview. The local PocketLedger account/session is resolved only when “View today’s spending” completes the existing OIDC code flow. No provider tokens or passwords are forwarded to the frontend or PocketLedger API.

`keycloak-config` registers/enables only the owned action and preserves built-in actions, users, credentials, volumes, and existing policy. It also sets the browser client's `baseUrl` to the approved application preview-start endpoint. Branded provider errors use that configured destination to start a fresh transaction instead of restarting an invalid transaction in a loop. Unknown clients get instructions to reopen PocketLedger, without an invented return URL.

The hosted login, registration, confirmation, and error templates consume the same packaged production CSS/SVG. Native forms post to Keycloak action URLs. A small deferred script supplies password visibility, pending/repeated-submit protection, field-error clearing, focus, and browser-history control restoration. Theme packaging rejects password-guidance limits that drift from the provider's realm policy.

## Alternatives and costs

- A query flag or browser storage would be simpler but could falsely claim account creation or show an untrusted email.
- A new application callback receipt/API could work, but would add a second confirmation contract, persistence/lifetime rules, and frontend routing. The provider already knows the newly created identity.
- A Keycloak required action adds a small version-specific Java SPI adapter and an administrative registration step. Its build and real-service tests must remain pinned to the provider version. This is a presentation acknowledgment, not a new profile requirement or credential policy.

Abandoning confirmation does not delete the already-created provider account. A later normal login can complete without repeating this transaction-only acknowledgment. Duplicate registration never replaces credentials. The default legacy journey, session expiry policy, account ownership, and planned Phase 5 cutover are unchanged.

## Verification

The retained browser suite covers confirmed creation/continuation, no local session before continuation, direct forged action/email requests, an existing user assigned the action without a creation note, registration boundaries/duplicates/races, and fresh-login recovery from a provider error. Configuration regressions prove idempotency and preservation of unrelated settings. See [learning note 018](../learning/018-hosted-authentication-experience.md) for commands, red/green evidence, visual review, and physical-device limits.
