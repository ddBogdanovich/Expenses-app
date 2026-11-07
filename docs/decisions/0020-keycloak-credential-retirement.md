# ADR 0020: Retire first-party credentials without transferring ownership

- Status: Accepted; verification is recorded in learning note 022.
- Date: 2026-11-07
- Supersedes the credential/JWT portions of [ADR 0005](0005-account-authentication.md), the dual-authentication and credential-kind portions of [ADR 0014](0014-keycloak-development-preview.md), and the temporary selector dependency in [ADR 0019](0019-default-browser-session.md).

## Context

The default browser already delegates login and registration to Keycloak. Keeping PocketLedger password verifiers, credential endpoints and JWT keys creates a second credential authority without a remaining product purpose. Old accounts must not gain a new identity through matching email, and retiring credentials must not delete expense history.

## Decision

Remove the register/login controllers and handlers, credential/token ports, password service, JWT issuer/settings/validation and bearer package registration. The existing PostgreSQL ticket-backed cookie is the sole default authenticate/challenge scheme. API challenges remain 401, never login redirects. OIDC continues only through the explicit hosted entry points. Keep the `PreviewCookie`, `PreviewOidc`, cookie name and `/api/auth/preview/*` paths to preserve existing protected tickets and provider callbacks. Historical selection headers are ignored; the unchanged frontend may continue sending them. No provider bearer-token API is added.

`ICurrentAccount` accepts only the application-owned local account claim on the cookie identity. New accounts require an exact trusted issuer/opaque subject. The repository has no email lookup contract; provisioning and concurrent uniqueness remain unchanged. Provider email remains a snapshot and never joins ownership.

Apply a new versioned `RetireLocalPasswordVerifiers` migration. Retain earlier migration files. Drop only `PasswordHash`, its obsolete credential-kind constraint and the filtered legacy email index. Keep every account ID, email snapshot, expense/owner foreign key, external identity mapping and browser ticket. Replace the constraint with an external-identity pair constraint: both fields are present or both absent. Absent identities describe inert retained legacy owners, not a new account creation path. Downgrade refuses explicitly because deleted verifiers cannot be reconstructed; restore a reviewed pre-cutover backup rather than fabricate credentials or delete owners.

Remove the `jwt-signing-key` AppHost parameter and API injection. Preserve its UserSecretsId, both named database volumes, all other secrets, and any now-unused signing-key entry already saved locally. Provider/admin secrets and persistent Data Protection remain necessary. Local Development/Testing enablement restrictions remain; production deployment is a separate decision.

## Cutover and alternatives

Use the documented [backup and fresh-account procedure](../learning/022-credential-retirement.md#cutover-and-fresh-account-procedure) before existing-database upgrade. Fresh users register through Keycloak and start with independently owned data. Retained external users keep their local GUIDs and expenses. No automatic account/password/expense migration, archive export, email linking or data reset occurs.

Deleting legacy owners would destroy historical data and violate the retained-data rule. Requiring non-null external identities would prevent upgrading those rows. Retaining verifiers or JWT validation would preserve the temporary dual authority. Renaming the established session/protocol paths would add frontend/provider reconfiguration and invalidate compatibility without helping credential retirement.

## Consequences and verification

Legacy owners cannot sign in or access their old expenses through the application. Recovery/export or ownership migration requires a separately designed and authorized feature. Verifier removal is irreversible, so backups matter. Historical files still mention passwords/JWTs as earlier learning material; current setup and model descriptions point to the cutover.

Acceptance tests prove 404 retirement, former-token rejection, startup without a JWT key, actual column removal, and upgrade preservation using real PostgreSQL. Retained real-Keycloak browser tests prove registration/races, login, ownership, reload/API restart, logout, session security and no silent disposable-data reset. See [learning note 022](../learning/022-credential-retirement.md) for exact evidence and limits.
