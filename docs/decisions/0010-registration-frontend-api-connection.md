# ADR 0010: Registration through a same-origin API path

- Status: Registration/session design superseded by [ADR 0016](0016-hosted-registration-confirmation.md), [ADR 0019](0019-default-browser-session.md), and [ADR 0020](0020-keycloak-credential-retirement.md); Vite proxy composition remains current.
- Date: 2026-11-01

## Context

The first interactive browser feature needs the existing email/password registration contract. Aspire assigns development endpoints dynamically. No budget or login screen exists yet.

## Decision

Use HeroUI v3 form components and native email/password constraints. Keep the 12–128 character password contract in a named frontend policy matching backend `PasswordPolicy`; backend validation remains authoritative. Submit JSON to `/api/auth/register` and accept success only for 201 with a nonempty access token. Show useful feedback for validation, conflicts, unavailable service, and network errors.

Aspire supplies `API_BASE_URL` from the API's HTTP endpoint to Vite and waits for API health. Vite proxies `/api` without rewriting paths. Standalone development defaults to the API's existing HTTP launch profile. Production must provide same-origin `/api` routing separately.

Hold the returned token in React memory and clear the password on success. Display an account-created screen, without inventing a dashboard or storing credentials or tokens in browser storage. Reload drops the session; login and a reusable authenticated session flow need a subsequent feature.

## Consequences

The browser requires no CORS configuration and the API keeps its current contract. A direct cross-origin client was an alternative, but would require allowed-origin configuration and a public API URL. Memory avoids persistent token storage but does not survive refresh. The duplicated password bounds need contract review when backend rules change. Vitest and Testing Library exercise interactive outcomes; real API verification still requires Aspire and Docker.

## Supersession

Hosted Keycloak registration/confirmation and default cookie sessions replace the JSON credential form and in-memory token design above. Phase 6 retires its backend credential endpoints and verifier/key storage. The same-origin Vite `/api` proxy remains; earlier rationale and evidence are historical.
