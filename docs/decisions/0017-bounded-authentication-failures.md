# ADR 0017: Bound preview authentication failures and protected caching

- Status: Accepted
- Date: 2026-11-07
- Supplements [ADR 0014](0014-keycloak-development-preview.md). Default bearer authentication remains current through Phase 4.

## Context

The preview already has PostgreSQL-backed tickets, 30-minute sliding idle expiry, an eight-hour absolute limit, and framework OIDC validation. Phase 4 must make failures predictable before the frontend switches to this contract. The old callback redirected every failure to a query flag, challenge failures could escape as exceptions, and authorization could short-circuit before cache protection ran.

## Decision

Keep the existing local session and confidential Authorization Code + PKCE mechanism. Let ASP.NET Core validate protected state, correlation, nonce, issuer, audience, and code exchange. Keycloak may use pushed authorization requests (PAR); PKCE parameters then travel over the confidential backchannel rather than appearing in the browser URL. Save no provider tokens and perform no refresh-token renewal. Local activity renews only the local ticket, bounded by its original absolute expiry. Provider administrator revocation does not immediately revoke an already issued local session.

Apply `Cache-Control: no-store, private` and `Pragma: no-cache` before authentication/authorization for all `/api/auth` and `/api/expenses` responses, including failures and redirects. API authentication challenges remain HTTP 401/403 without browser redirects. This protects HTTP responses; Phase 5 still owns clearing rendered frontend content and browser Back behavior.

Accept `returnUrl` on the preview start endpoint only when it exactly equals `/preview`, `/`, or `/design-system`. Reject every other value with HTTP 400 `auth.invalid_return`, without initiating provider work. An allowed destination does not grant access to that route; preview design-reference integration remains Phase 5.

Return bounded JSON `{ code, status, title }` for protocol failures, without redirecting or echoing provider messages:

| Failure | HTTP | Code |
| --- | --- | --- |
| Missing/invalid state or other callback failure | 400 | `auth.callback_failed` |
| Valid state with missing/failed correlation, including expiry/replay | 400 | `auth.transaction_expired` |
| Provider cancellation with valid state/correlation | 400 | `auth.cancelled` |
| Provider transport/timeout or server error during challenge/callback/logout | 503 | `auth.provider_unavailable` |
| Missing/invalid/expired local session on protected API | 401 | Existing API challenge; no redirect |

A narrow backchannel handler turns HTTP 5xx into a sanitized transport exception before the OIDC library parses metadata, PAR, or token responses. The boundary catches transport failures only for preview start/logout; callback failures go through the framework remote-failure event. Programming and database exceptions retain their existing failure semantics. Request cancellation is not a provider outage response after the caller has disconnected. No provider response bodies or exception text reach the failure JSON.

Local logout revokes the database ticket before the provider sign-out navigation. An in-flight renewal cannot recreate a revoked ticket. Provider sign-out is token-free and may ask for confirmation. An immediate backend outage response depends on a backchannel request (discovery, PAR, or code exchange). A browser encountering an outage after a redirect cannot always be diagnosed by the backend. The provider must be reachable and its confirmation completed to end its SSO session; local revocation remains effective if the provider is unavailable.

Keep HttpOnly/Lax session cookies, request-bound antiforgery for cookie mutations, exact trusted issuer/opaque subject ownership, and persisted protected tickets/keys. Correlation/nonce cookies use secure transport policy consistently with session cookies: HTTP loopback is a Development/Testing exception, and HTTPS requests set Secure. Enabled preview configuration remains rejected outside these environments.

Suppress raw OIDC protocol logging, whose exceptions/descriptions can contain provider input. Suppress callback request-start/finish logs and retain OpenTelemetry's default URL-query redaction. Do not enable sensitive protocol/body/header logging or disable instrumentation redaction. Safe HTTP status/route telemetry remains available; raw failure diagnostics trade detail for confidentiality.

## Alternatives and costs

Redirecting all failures hides their cause and can encourage retry loops. Persisting provider tokens would enable refresh/revocation strategies but adds credential custody and changes the chosen session architecture. Custom state or PKCE validation would duplicate framework security logic. Parsing arbitrary provider exception messages would be brittle and could expose secrets; the only framework message classification retained is the tested correlation-failure marker, with a generic fallback for unknown failures.

This adds a small pipeline boundary, failure writer, and transport adapter. Stable codes become an API contract for Phase 5. No frontend, account linking, schema migration, data reset, production enablement, or default authentication cutover is included.

## Verification

See [learning note 019](../learning/019-session-security-and-failure-contracts.md) for test-first results, real Keycloak callback/outage tests, session boundaries, log checks, and remaining frontend responsibilities.

## Phase 5 supplement

[ADR 0019](0019-default-browser-session.md) supersedes the browser preview/default split and the reference’s bearer-session gate. HTML document failures now navigate to bounded recovery; API JSON/status contracts and identity/session security remain. Historical rationale above is retained.
