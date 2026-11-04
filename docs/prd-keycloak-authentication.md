# PRD: Keycloak authentication with PocketLedger UI preservation

**Date**: 2026-11-03
**Status**: Draft

## Goal

Delegate credential verification and authentication sessions to Keycloak so the owner can focus on budgeting features while learning standards-based identity integration. Preserve the current PocketLedger login and registration design, mobile accessibility, and account-to-spending journey while using Keycloak's recommended browser redirect flow.

This document specifies a future milestone; the current application still uses its own authentication implementation.

## User scenarios

- A signed-out user opens PocketLedger or `/login` -> the PocketLedger-branded login form is shown through the Keycloak authentication flow.
- A new user opens `/register` or selects “Create an account” -> a PocketLedger-branded registration form accepts their email and password without requiring a separate username, name, or password confirmation field.
- A new user completes registration -> the existing “You’re all set.” confirmation identifies their email and offers “View today’s spending”; continuing opens their authenticated daily spending page.
- A returning user enters valid credentials -> today's spending opens without an additional intermediary login screen.
- A user enters invalid credentials, an invalid registration value, or an already registered email -> a readable error appears with a way to correct the input; the page does not indicate success.
- A signed-in user reloads or revisits PocketLedger while their browser session remains valid -> the application restores access without asking for credentials again.
- A user whose session has expired requests protected content -> they return to the branded login flow with a clear explanation and can sign in again.
- A signed-in user logs out -> protected content is hidden, both the PocketLedger and Keycloak sessions end, and visiting protected content again requires authentication.
- A user encounters an unavailable identity service or an interrupted authentication flow -> they see a recoverable failure with a retry or return action, rather than an endless redirect or a false signed-in state.
- The owner stops and restarts the local development environment -> previously created Keycloak accounts can still log in and access their own persisted expenses.

## Scope

- Replace PocketLedger-managed password authentication with Keycloak for email/password registration, login, and logout.
- Run Keycloak locally in Docker under the existing Aspire development workflow, with persistent identity data separate from application data.
- Use Keycloak-hosted credential pages customized to preserve PocketLedger's current UI/UX. Authentication redirects are expected; keeping the credential forms inside the existing React application is not a requirement.
- Preserve `/login` and `/register` as public entry points and preserve continuation to today's spending and the protected development design reference where applicable. Registration retains its confirmation step.
- Preserve the existing wordmark/monogram, forest-green and warm off-white light theme, system typography, desktop introduction beside the form, form-first compact layouts, and plain-English product copy.
- Preserve email/password fields, show/hide password behavior, password-manager support, field validation, request-error notices, pending feedback, protection against repeated submissions, and keyboard/focus behavior. Provider-required security messages may use equivalent PocketLedger-styled wording.
- Retain email as the login identifier, including trimmed, case-insensitive identity behavior, and retain the existing 12–128-character registration password policy.
- Restore authentication across page reloads and browser revisits while the session remains valid; require a new login after expiration or explicit logout. This is the recommended behavior for this milestone, replacing the current loss of authentication on reload.
- Keep expense ownership and access decisions in PocketLedger. A provider identity must resolve to a stable local account identity; repeat logins must not create duplicate local accounts.
- Permit a fresh-account start at cutover. Existing account/password/expense migration is not required; document any development-data reset and its consequences before implementation performs it.
- Cover login, registration, confirmation, logout, expired-session, callback failure, and provider-unavailable states with the same visual and accessibility standards.

## Not in scope

- Migrating existing passwords, accounts, or their expenses to new Keycloak identities.
- Password recovery, email verification, MFA, passkeys, social login, account linking, or a user profile/account-management feature.
- New identity fields, a separate username, a “Remember me” option, or changes to the budgeting experience.
- Redesigning account screens or adding dark mode.
- Customizing Keycloak's administrator or account-management consoles.
- Production hosting, Kubernetes deployment, a managed identity-provider evaluation, or production email delivery.
- Running the previous password/JWT issuance system as a permanent alternative login method.
- New allowance calculations, expense features, messaging, or unrelated refactoring.

## Technical constraints

- The selected provider is Keycloak. Authentication must use OpenID Connect Authorization Code flow with PKCE and browser redirects; Direct Access Grants/password forwarding through PocketLedger are excluded. See [Keycloak's flow guidance](https://www.keycloak.org/securing-apps/oidc-layers).
- User passwords must be submitted to Keycloak, never to PocketLedger's API. PocketLedger must no longer store password verifiers or issue its former first-party access tokens after cutover.
- Use [Keycloak-supported UI customization](https://www.keycloak.org/ui-customization/themes) while honoring the existing [design guide](design/README.md). Preserving the user experience does not require identical React source code or identical browser URLs during authentication.
- Browser authentication must not expose provider client secrets or store access/refresh tokens in localStorage or sessionStorage. Production session handling must support HTTPS, CSRF protection where applicable, and explicit session expiration/logout behavior.
- Successful access requires a validated identity from the configured provider and intended application context. Invalid, expired, tampered, wrong-issuer, or wrong-audience tokens must not grant API access; ID tokens must not be accepted as API access tokens.
- An external subject is an opaque identifier scoped to its issuer, not an assumed PocketLedger GUID. Email equality alone must not link identities to existing expense owners.
- Preserve the modular monolith, framework-independent budgeting domain, vertical slices, owner-filtered expense access, PLN integer-grosz values, and Warsaw business dates described in the [domain model](domain-model.md).
- Retain .NET 10, the existing React frontend, HeroUI v3/Tailwind CSS v4 application conventions, Aspire, OpenTelemetry, and Docker-backed integration verification. Theme tooling and exact session settings belong in a subsequent technical design.
- Local identity configuration must be reproducible from the repository without committing real credentials, private signing keys, or user data. Ordinary startup must not overwrite saved users or reset their credentials.
- Preserve the existing application PostgreSQL volume and on-demand dashboard test runner. Integration tests must use disposable identity/application data rather than developer accounts or databases.
- Authentication must fail closed during failures. Redirect destinations must be restricted to approved application locations, and logs/telemetry must exclude passwords, tokens, session cookies, and client secrets.

## Definition of done

- [ ] Aspire starts the local identity provider alongside existing resources, reports its readiness, and makes relevant failure logs available. The dashboard `tests` resource remains inactive until explicitly started.
- [ ] A clean checkout has documented setup steps that produce working login and registration without manual reconstruction of realm/client settings. All sensitive values are supplied outside committed source.
- [ ] A new user can register with email and password only, sees the PocketLedger confirmation screen, and continues to today's spending without a second credential prompt.
- [ ] Registration accepts the current password-policy boundaries and rejects values outside them; email whitespace/case variations cannot create duplicate identities. Tests verify these outcomes against Keycloak.
- [ ] Valid login opens today's spending; invalid credentials and duplicate registration show actionable errors without false success. Invalid login does not reveal whether an account exists.
- [ ] The login/registration switch, show/hide password control, autocomplete, paste, pending feedback, and repeated-submission protection work on the final hosted pages.
- [ ] Reloading and revisiting PocketLedger restores a still-valid session. With an expired session, protected content is hidden and login is offered without a redirect loop.
- [ ] Logout ends the application and provider sessions. Reload, browser Back, and a new protected-page visit do not restore access to protected data without authentication.
- [ ] Provider outage, failed/cancelled callback, and expired authentication transaction each have an exercised recovery path; none leave a false authenticated state or an indefinite loading screen.
- [ ] Two independently registered users can access only their own expense records and totals. Repeated and concurrent first logins resolve each identity to one local account; foreign expense IDs still return NotFound.
- [ ] A Keycloak account and its newly created PocketLedger expenses remain accessible after local resources stop and restart; startup does not replace the account or change expense ownership.
- [ ] Browser/network inspection confirms credential submission goes only to Keycloak. The old API credential endpoints no longer authenticate users or issue first-party tokens, old first-party tokens are rejected, and the API starts without the former `Jwt__SigningKey` requirement.
- [ ] API/session security tests reject unauthenticated and invalid authentication attempts, unapproved redirect destinations, and forged session-changing requests where applicable. Sensitive credentials and tokens do not appear in captured application logs or browser storage.
- [ ] Before/after screenshots are visually reviewed for login, registration, and registration confirmation. They retain the current brand, colors, typography, content hierarchy, desktop composition, and compact form-first layout; all exercised authentication error/pending states use the same design language.
- [ ] Final Playwright MCP validation and project-local UI/UX skill review report no unresolved issues. Validate desktop, all large/small-phone sizes, landscape, tablet, short viewport, 200% text, and reduced motion from the [existing browser matrix](learning/014-mobile-layout-and-accessibility.md#verification-and-its-limits), including keyboard operation, focus transitions, scrolling, contrast, and touch targets. Record physical iPhone verification limits separately.
- [ ] Frontend build, lint, and behavior tests pass; relevant backend build, behavior/integration tests, and formatting checks pass. Integration coverage exercises real Keycloak and disposable PostgreSQL, not only mocked authentication.
- [ ] Protected `/design-system` access and return after login still work in development; the reference remains excluded from production output.
- [ ] The cutover/reset procedure states that old local accounts and expenses are not migrated, identifies affected data, and avoids silent deletion during normal startup.
- [ ] Implementation updates the README, root/frontend agent instructions, domain identity descriptions, design guide, relevant learning notes and examples, and architecture diagrams. A new ADR records the final design and marks replaced authentication decisions as superseded without rewriting their historical rationale.
