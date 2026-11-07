# ADR 0014: Introduce an isolated Keycloak development preview

- Status: Accepted for Phase 1 implementation; runtime verification is tracked separately.
- Date: 2026-11-04
- Implements the first slice of the [Keycloak plan](../plan-keycloak-authentication.md).
- Supplements [ADR 0005](0005-account-authentication.md) and [ADR 0013](0013-code-backed-frontend-design-system.md). Their default authentication behavior remains current until cutover.

## Context

PocketLedger currently verifies passwords and issues JWTs. The new milestone delegates credentials to Keycloak while preserving expense ownership and existing account-screen design. A development preview must coexist with the default flow without allowing one flow's credentials to authorize the other.

The [research](../research-keycloak-authentication.md) identified the email unique index, GUID subject parsing, callback proxy origin, and logout token transport as decisions requiring explicit treatment.

## Decision

Use the existing API as a backend for frontend. Register a confidential Keycloak client in the `pocketledger` realm; use Authorization Code, PKCE S256, nonce/state/correlation validation, and server-side code exchange through ASP.NET Core's OIDC handler. Passwords are submitted only to Keycloak. Do not add a public SPA client or provider bearer authentication.

Use a PostgreSQL-backed `ITicketStore` and an opaque HttpOnly cookie. Persist a protected authentication ticket with the resolved local account identity, not access/refresh tokens (`SaveTokens=false`). Cookie/session expiration is 30 minutes idle, sliding, with an independent 8-hour absolute bound. The bounded cookie is persistent: closing the browser does not explicitly log out, but browser privacy settings may remove it. API restarts retain sessions only with the same database and Data Protection key ring. Renewal must never reinsert a revoked session.

Provider and local sessions are distinct. Existing unexpired local sessions can continue during a provider outage; new login fails closed. Immediate provider administrator revocation is not promised in this slice. Back-channel logout/renewal are later security decisions, not implied capabilities.

Initiate local logout with an antiforgery-protected POST, revoke the local ticket, and perform standards-based provider logout with `client_id`, protected logout state, and an exact approved callback. Omit `id_token_hint` to keep provider tokens out of browser transport. Accept and brand Keycloak's logout confirmation where required. Only claim both sessions ended after provider completion; provider outage cannot guarantee remote logout.

Use named legacy bearer, preview cookie, and preview OIDC schemes. Preview fetches explicitly select the cookie scheme using `X-PocketLedger-Auth: preview`; the selector is not a credential. Default requests select legacy bearer. Never merge identities or fall back across schemes. Preview protocol endpoints select their schemes explicitly. Reject unknown selectors. Cookie-authenticated expense mutations and logout require antiforgery tokens. Preview is enabled only in Development/Testing with validated settings; it is not a production alternative authentication mode.

Resolve the exact trusted `(issuer, subject)` pair to a locally generated account GUID. Subjects remain opaque and case-sensitive. External identity and password verifier are mutually exclusive account credential kinds. Preserve the legacy email uniqueness rule with a filtered index, while external account emails are snapshots and not unique ownership keys. A reused legacy email creates a new local account without transferring expenses. Provision through a vertical-slice handler/repository with database uniqueness, not middleware SQL or email-based linking.

Keep callbacks beneath `/api/auth/preview/` so Vite forwards them. Configure the validated browser-facing origin explicitly; callback and return URLs never derive from untrusted Host/forwarded headers. Allow only the preview spending route as the Phase 1 continuation. Use query response mode for the code callback. On HTTPS use secure cookies; HTTP exceptions are restricted to enabled local Development/Testing preview and use Lax transaction cookies. Production preview is disabled. HTTPS and additional security/failure scenarios are completed in Phase 4.

### Theme tooling

Use supported native FreeMarker themes plus existing compiled application CSS and shared SVG. Generate a theme resource directory from the Web production CSS build; do not duplicate palette values or maintain a second frontend framework. Keep template and a small external interaction script under `infra/keycloak/`. Preserve labels, password visibility, autocomplete, safe areas, and existing layout recipes. A shared named page container collapses columns at enlarged text when available content is insufficient, resolving the tablet 200% review finding.

This chooses the native-theme alternative evaluated by the research rather than its preferred Keycloakify option: Phase 1 needs one hosted form, and native templates avoid a second React/Vite build plus Java/Maven packaging dependencies. The tradeoff is explicit markup maintenance and template compatibility review on Keycloak upgrades. HeroUI remains the browser application's component system; hosted native controls reuse its compiled visual recipes. Phase 3 must prove full hosted login/registration parity before treating theme work as complete. Registration confirmation remains the default legacy UI in Phase 1; truthful provider-backed confirmation is a later milestone.

### Infrastructure and configuration

Pin the tested Keycloak image and hosting integration package. Run a separate identity PostgreSQL database/server with its own named volume, outside `pocketledger-postgres-data`. Import a user-free versioned realm template with runtime secret placeholders. Supply the confidential-client secret and bootstrap administrator secret from Aspire parameters. Startup imports skip existing realms; a narrow authenticated Node configuration step idempotently reconciles browser callback/logout URLs on startup without changing users or client credentials. Other future configuration updates need explicit non-destructive reconciliation. Browser URLs must be resolved without container-host rebasing.

No developer user is seeded with committed credentials. The preview uses a locally created Keycloak user; automated acceptance fixtures seed disposable users with per-run random credentials. Document that setup distinctly. Preserve AppHost UserSecretsId, existing application volume, and explicit-start `tests` resource without developer connection/signing secrets.

## Fresh-account cutover and data safety

No reset or account/password/expense migration is performed. Legacy accounts and their expense foreign keys remain intact. The additive preview migration permits new external accounts, including the same email as a legacy account; legacy login cannot authenticate the external row. The future retirement migration removes verifier storage but must retain historical account/expense rows unless a separately authorized reset explicitly identifies the affected database, volume, accounts, and expenses. Destroying/recreating a realm can change subjects and does not migrate ownership. A volume is not a backup.

Do not delete `pocketledger-postgres-data`, the identity volume, or unrelated user secrets. A reset procedure must first document backup/export and the exact ownership/data consequences, then obtain authorization for deletion. Normal startup never resets credentials or replaces users.

## Verification and consequences

The retained Playwright suite starts a network-reachable API and Vite with disposable PostgreSQL/Keycloak. Write/run its missing-preview assertion before product changes, preserve the already-green default journey, and rerun real login → local account → expense → reload → logout after implementation. UI changes additionally require Playwright MCP and the local UI/UX skill at the complete mobile/text matrix. See [learning note 016](../learning/016-keycloak-preview.md) for evidence and limitations.

PostgreSQL session reads and a small ticket-store implementation are additional costs; they provide explicit revocation and restart persistence without Redis. Custom token/protocol code, a separate BFF service, permanent dual authentication, automatic account linking, provider registration parity, and production deployment are excluded from this phase.

## Phase 2 supplement

[ADR 0015](0015-keycloak-registration-policy.md) adds the provider registration policy and non-destructive flow/profile/policy reconciliation. The URL-only configuration scope above describes the original Phase 1 implementation; Phase 2 expands that owned scope while preserving users, credentials, client secrets, and built-in flows.

## Phase 5 supplement

[ADR 0019](0019-default-browser-session.md) supersedes the browser preview/default split and the reference’s bearer-session gate. HTML document failures now navigate to bounded recovery; API JSON/status contracts and identity/session security remain. Historical rationale above is retained.

## Phase 6 supersession

[ADR 0020](0020-keycloak-credential-retirement.md) supersedes first-party credential storage/endpoints/JWT services and signing-key configuration, the dual-authentication selector, and the legacy-only email index. The default cookie path retains existing scheme/callback/cookie names. Legacy owner/expense rows remain inaccessible historical data. Earlier decisions and verification above retain their historical rationale.
