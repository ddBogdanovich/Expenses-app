# ADR 0015: Own registration policy inside Keycloak

- Status: Accepted
- Date: 2026-11-05
- Supplements [ADR 0014](0014-keycloak-development-preview.md); default JWT authentication remains current.

## Context

Phase 2 requires email/password-only registration, normalized email uniqueness, password lengths 12–128, and stable local ownership under concurrent first login. Keycloak 26.8.1 supports length policies and configurable user profiles, but its built-in registration password action also requires matching confirmation. Realm startup import skips an existing realm, so editing an import alone cannot upgrade an existing developer environment.

## Decision

Keep credentials entirely inside Keycloak. Add one `FormAction` extending its user-creation action: strip/lowercase registration email with `Locale.ROOT`, supply the same submitted password as the internal confirmation value, then delegate user-profile validation/creation. The following built-in password action retains policy validation, hashing, and credential storage. No password policy or cryptography is implemented in PocketLedger's API.

Use an owned, versioned registration flow and an email-only end-user profile. Disable email verification, recovery, implicit grants, Direct Access Grants, service-account login, and username editing for this preview. No social provider or MFA requirement is introduced. The realm enforces email/username uniqueness, including database races. This is a preview policy, not a decision about production account recovery.

Compile the small provider JAR in Docker against the pinned runtime's own dependencies and a digest-pinned Java 21 compiler image. Mount the ignored build artifact read-only in Aspire and E2E. This avoids a host JDK/Maven prerequisite while adding an explicit build step. The form-action SPI is internal; Keycloak upgrades require rebuilding and rerunning the retained real-service tests.

Reconcile owned policy through authenticated administration before API startup. Create the owned versioned flows when absent, enforce required executions, update owned profile/realm/client settings, and retain exact approved browser URLs. Preserve users, credentials, client secrets, built-in flows, unrelated client attributes, application/identity volumes, and AppHost UserSecretsId. No reimport, reset, account linking, or schema migration is needed. Fail on unexpected executions in the owned flow rather than deleting them.

Keep the existing exact `(issuer, opaque subject)` provisioning path. Its unique index and loser-read recovery already satisfy Phase 2; prove them with independent concurrent PostgreSQL scopes and an explicit conflicting insert. Mutable email never becomes an ownership key.

## Alternatives and costs

Keeping confirmation would violate the requested single-password contract. Client-side copying alone would leave the server contract dependent on JavaScript. Reimplementing registration in the API would move credentials back into PocketLedger. A narrow provider action is more code than pure realm configuration, but keeps the exception beside the provider that owns it.

Phase 2 deliberately leaves templates unchanged. The inherited registration form can display confirmation even though the server no longer requires it. A simultaneous duplicate can produce Keycloak's generic denial page after its unique constraint wins. Phase 3 owns branded forms, confirmation, entry links, and recoverable presentation; these limitations do not authorize extra provider accounts or replacement credentials.

## Verification

Run the retained suite against current imports and `E2E_REALM_BASELINE=phase1`. Both reconcile twice and exercise real browser code flow, policy boundaries, duplicate/race integrity, retained credentials, two-owner expense isolation, and Phase 1 regressions. PostgreSQL tests verify opaque/case-sensitive subjects, issuer separation, concurrent provisioning, and continued use of a losing repository scope. Evidence and exercises live in [learning note 017](../learning/017-registration-policy-and-concurrent-identity.md).

Pinned provider sources: [RegistrationPassword](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/forms/RegistrationPassword.java), [RegistrationUserCreation](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/authentication/forms/RegistrationUserCreation.java), and [profile import fixture](https://github.com/keycloak/keycloak/blob/26.8.1/tests/base/src/test/resources/org/keycloak/tests/model/import-userprofile.json).
