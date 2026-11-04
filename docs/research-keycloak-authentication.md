# Research: implementing Keycloak authentication in PocketLedger

**Researched:** 2026-11-04
**Inputs:** [implementation plan](plan-keycloak-authentication.md), [draft PRD](prd-keycloak-authentication.md), and repository working state based on `d233787`.
**Status:** recommendations for technical design; no application changes, accepted ADR, runtime proof, or data reset are included in this research.

## Recommendation

Use the existing ASP.NET Core API as a backend for the React frontend: it runs the OpenID Connect (OIDC) redirect flow and authenticates browser requests with an opaque session cookie. Keycloak owns credentials; PocketLedger owns the local account GUID and expense authorization. Keep the modular monolith and existing controllers/handlers. A separate BFF service, token-forwarding gateway, Redis, and Keycloak authorization services would add little value at this milestone.

Recommended choices are:

| Concern | Proposed implementation | Reason |
| --- | --- | --- |
| Browser authentication | Confidential OIDC client, Authorization Code + PKCE S256, ASP.NET Core OIDC middleware | Standards-based integration without implementing the protocol |
| Application session | Cookie handler with PostgreSQL-backed `ITicketStore` | Browser receives a session reference; logout can invalidate copied cookies |
| Provider tokens | `SaveTokens = false`; no downstream API or refresh workflow initially | Budgeting endpoints authenticate the local session and do not need provider bearer tokens |
| Account identity | Unique exact `(issuer, subject)` mapped to a locally generated GUID | Provider IDs and mutable emails cannot become expense owner IDs |
| Hosted UI | Separate Keycloakify React theme package; reuse existing CSS tokens/assets and HeroUI recipes | Best fit for the required visual/interaction parity and React learning objective |
| Registration confirmation | Provider-controlled confirmation after successful registration; prototype a small FormAction/RequiredAction extension | An application route or a newly provisioned local row does not prove Keycloak registration occurred |
| Local infrastructure | Official Aspire Keycloak hosting integration; separate PostgreSQL instance/database and named identity volume | Preserves application data and makes identity resets independent |
| Verification | Existing .NET tests plus retained Playwright E2E against disposable real services, and required Playwright MCP/UI review | Protocol, persistence, policy, and UI claims need different evidence |

These choices optimize for one maintainer and this PRD. The PostgreSQL ticket store and provider confirmation extension have real maintenance costs; their reasons and alternatives are described below.

## 1. Current implementation and its implications

The repository still implements first-party authentication. The plan and PRD describe future work.

| Observed implementation | Consequence for the migration |
| --- | --- |
| [`AuthenticationServiceCollectionExtensions.cs`](../src/PocketLedger.Infrastructure/Authentication/AuthenticationServiceCollectionExtensions.cs) registers symmetric JWT validation, password hashing, and token issuance | Add an independent preview scheme first; remove old services and signing-key validation only at retirement |
| [`CurrentAccount.cs`](../src/PocketLedger.Infrastructure/Expenses/CurrentAccount.cs) parses `sub` as a GUID | Preview account resolution must replace this assumption without changing expense ownership semantics |
| [`CurrentAccountController.cs`](../src/PocketLedger.UseCases/Authentication/CurrentAccount/CurrentAccountController.cs) returns raw `sub` | `/api/auth/me` must return the resolved local ID, not the provider subject |
| [`UserAccount.cs`](../src/PocketLedger.Domain/Accounts/UserAccount.cs) requires a password hash; its [EF mapping](../src/PocketLedger.Infrastructure/Persistence/UserAccountConfiguration.cs) requires globally unique email | Preview accounts need an explicit external-identity construction path and an email-index migration |
| [`App.tsx`](../src/PocketLedger.Web/src/App.tsx) holds bearer tokens in memory | Session restoration is a frontend contract change, not just replacing JWT validation |
| [`vite.config.ts`](../src/PocketLedger.Web/vite.config.ts) proxies `/api` with `changeOrigin: true` | Middleware-generated callback origins can differ from the browser origin |
| [`AuthenticationDatabase.cs`](../tests/PocketLedger.Api.Tests/AuthenticationDatabase.cs) uses PostgreSQL and `WebApplicationFactory` | Retain fast HTTP integration coverage, but a browser also needs a network-reachable API host |
| [AppHost](../PocketLedger.AppHost/AppHost.cs) uses an explicit application volume, persisted JWT secret, and explicit-start test resource | Preserve these during preview; preserve volume/UserSecretsId permanently; retire only the obsolete JWT parameter |

The AppHost SDK and stable hosting packages are **13.5.4**, and `global.json` selects **10.0.400**. Some installed Aspire skill prose describes 13.4; recommendations must follow installed APIs rather than that version label. The frontend is React 19, Vite 8, HeroUI 3, and Tailwind 4. Existing tests use xUnit v2.

Read the existing [domain model](domain-model.md), [authentication ADR](decisions/0005-account-authentication.md), [controller ADR](decisions/0006-controllers-and-named-policies.md), and [design-system ADR](decisions/0013-code-backed-frontend-design-system.md) when writing the subsequent technical design. Research does not supersede them.

## 2. Authentication architecture and alternatives

OIDC establishes who signed in. PKCE binds the authorization code exchange to the initiating client transaction. The backend then creates its own application session; this session is distinct from Keycloak's SSO session. Microsoft documents confidential code-flow clients with PKCE and cookie authentication for this architecture. Use the framework handler rather than writing code exchange, signature validation, nonce, or correlation logic. [ASP.NET Core OIDC guidance](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-oidc-web-authentication?view=aspnetcore-10.0).

```mermaid
sequenceDiagram
    participant Browser
    participant API as PocketLedger API
    participant KC as Keycloak
    participant DB as Application PostgreSQL
    Browser->>API: Start login or registration
    API-->>Browser: OIDC challenge with state and PKCE
    Browser->>KC: Hosted form; credentials go here
    KC-->>Browser: Authorization code redirect
    Browser->>API: /api/auth/callback
    API->>KC: Server-side code exchange
    API->>API: Validate provider identity
    API->>DB: Resolve issuer/subject; store session
    API-->>Browser: Opaque cookie; approved return route
    Browser->>API: Owned expenses with session cookie
    API->>DB: Query by resolved local owner GUID
```

| Alternative | Advantages | Costs / fit |
| --- | --- | --- |
| `keycloak-js` in the SPA | Official adapter; useful for browser clients that must call token-protected APIs directly | Browser holds tokens and owns renewal; does not meet the plan's server-side-token direction |
| Encrypted self-contained authentication cookie | Least server storage/code | Ticket, and any saved tokens, travel in the cookie; deleting one browser cookie does not invalidate a stolen copy |
| Existing API + server-side ticket store | Central expiration/revocation; no additional service | Database lookup, cleanup, ticket serialization, and concurrency behavior to maintain |
| Separate BFF / commercial BFF framework | Useful when proxying multiple downstream APIs or needing a broader packaged security feature set | Additional deployment/dependency/licensing evaluation without a present downstream-API need |

Keycloak's JavaScript adapter uses a public client because browser code cannot protect a client secret. Its integration remains a valid alternative for a different product requirement. [Official JavaScript adapter](https://www.keycloak.org/securing-apps/javascript-adapter).

Do not add a Keycloak bearer scheme just to resemble JWT tutorials. In the recommended final architecture, a provider access token or ID token supplied in `Authorization` authenticates **nothing**. The OIDC callback validates its ID token for the confidential client; that does not make ID tokens API credentials. If a future mobile/public API needs bearer access, introduce its separate audience and access-token validation then. This reduces the current token-confusion attack surface. [OIDC Core validation rules](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation).

## 3. Local sessions, expiration, and logout

### Server-side ticket storage

`CookieAuthenticationOptions.SessionStore` accepts `ITicketStore`; with it the client receives a session identifier instead of the identity ticket. This is an authentication ticket store, distinct from ASP.NET Core `ISession` and `AddDistributedMemoryCache`. [SessionStore API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.authentication.cookies.cookieauthenticationoptions.sessionstore?view=aspnetcore-10.0).

Implement the store in Infrastructure using the existing application PostgreSQL database. A focused table should contain an unpredictable session key, protected serialized ticket, creation time, idle/absolute expiration, and concurrency/version information. Index expiration for bounded cleanup. Keep session storage out of the domain aggregate. Persist only necessary claims and transaction metadata; do not retain access or refresh tokens when there is no consumer.

Renewal must update an existing active row, never recreate a removed session. Otherwise an in-flight request can resurrect a session after logout. Test concurrent renewal/logout, expired-row reads, corrupt tickets, and store failure. A store outage must deny access or return a bounded unavailable response, rather than falling back to a self-contained cookie.

Use ASP.NET Core Data Protection for tickets/state, with a stable application name and a persistent protected key ring. Persisting database session rows alone is insufficient if the API loses the keys needed to read them. Separate environments/test runs by key ring and application name; never commit keys. [Data Protection configuration](https://learn.microsoft.com/en-us/aspnet/core/security/data-protection/configuration/overview?view=aspnetcore-10.0).

### Proposed session policy

These are **PocketLedger design recommendations**, not Keycloak or ASP.NET defaults. Record and finalize them in the Phase 1 ADR.

| Setting | Initial recommendation |
| --- | --- |
| Idle lifetime | 30 minutes, renewed by authenticated activity |
| Absolute lifetime | 8 hours from initial login; never extended by sliding renewal |
| Browser persistence | Bounded persistent cookie, without adding a Remember me control |
| Browser close | Does not explicitly log out; revisits work until idle/absolute expiration. Browser privacy settings can remove the cookie sooner |
| Authentication transaction | 10-minute maximum; align provider and middleware configuration and test expiry |
| Cookie | Host-only; `HttpOnly`; `Secure` on HTTPS; `SameSite=Lax`; `Path=/` |
| Tokens after callback | Discard; no offline scope and no refresh-token storage/rotation initially |

Set and enforce absolute expiration separately from the cookie handler's sliding expiration. Keep the initial login timestamp stable across renewal and apply the same upper bound in the store. Persistent-cookie renewal must not extend its browser expiration past that bound. Framework cookies distinguish persistent browser storage from ticket lifetime; API endpoints in ASP.NET Core 10 normally return 401/403 rather than a login redirect. Still assert the configured behavior explicitly. [Cookie authentication](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/cookie?view=aspnetcore-10.0).

Without refresh/introspection/back-channel logout, a valid local ticket does not continuously prove the Keycloak session remains active. Recommend that already-valid local sessions continue during a provider outage, within their bounds; new authentication fails closed. This does not claim immediate response to administrator revocation in Keycloak. If immediate provider revocation becomes required, add validated back-channel logout or a separately designed provider check; do not silently promise it through cookie expiration settings.

### Logout has a specific token-exposure tradeoff

The usual RP-initiated logout sends `id_token_hint` through the browser to Keycloak. Although it is not an API access token, it is still a provider token. This conflicts with a literal reading of “provider tokens remain server-side.” The standard allows logout without that hint and recommends user confirmation for such requests. [RP-Initiated Logout specification](https://openid.net/specs/openid-connect-rpinitiated-1_0.html).

For the strict token boundary, recommend an antiforgery-protected POST that invalidates the local session and navigates to Keycloak logout with `client_id`, an exact registered post-logout destination, and protected logout state, **without** `id_token_hint`. Theme and test the provider's confirmation screen. Do not report both sessions ended until the provider flow completes. The framework sign-out message may need its redirect event configured to include `client_id`; verify against the pinned handler. [ASP.NET Core handler source](https://raw.githubusercontent.com/dotnet/aspnetcore/v10.0.11/src/Security/Authentication/OpenIdConnect/src/OpenIdConnectHandler.cs).

If a one-click logout is required, the design must explicitly revisit transient ID-token transport or choose another supported server-side mechanism with its privilege/complexity costs. Keycloak-to-application back-channel logout is a notification mechanism; it does not by itself initiate provider logout. Do not substitute the legacy refresh-token logout call: Keycloak documents that endpoint style as non-standard and not recommended. [Keycloak OIDC endpoints](https://www.keycloak.org/securing-apps/oidc-layers).

Provider failure during logout cannot guarantee the provider cookie/session was cleared. Always clear local access; show “signed out here; complete sign-out unavailable” recovery and avoid automatic SSO login loops. Clear frontend protected state before navigation, revalidate on `pageshow`/visibility, and test Back, reload, another tab, and replay of the pre-logout cookie. `Cache-Control: no-store` on protected responses helps but does not alone prove that browser history cannot display stale content.

## 4. Stable account ownership and safe schema evolution

An OIDC identity is the exact pair `(iss, sub)`. Treat `sub` as opaque and case-sensitive; do not parse it as a GUID. Compare the configured issuer exactly, rather than normalizing URL case/trailing slashes. Generate PocketLedger's GUID once and retain all expense owner foreign keys. Never accept an owner ID, email, or provider claim as a substitute for the resolved local ID. [OIDC subject identifiers](https://openid.net/specs/openid-connect-core-1_0.html#SubjectIDTypes).

Recommended minimal model:

```text
UserAccount
  Id: local GUID
  Email: display/contact snapshot, not an ownership key
  ExternalIdentity: optional during preview; required for new external accounts
    Issuer: exact trusted issuer
    Subject: opaque string
  PasswordHash: legacy accounts only during preview; removed in Phase 6

Database: unique filtered (Issuer, Subject) for external accounts
          unique Email for legacy accounts only during preview
```

Use an external-identity value object owned by `UserAccount` rather than introducing a generic federation/account-linking subsystem. A separate identity table becomes useful when multiple providers per account are actually authorized. A `ResolveExternalAccount` handler and aggregate-specific repository operation fit the existing vertical slices. OIDC events adapt validated claims into that handler; framework events should not contain provisioning SQL or domain construction rules.

**The current global unique email index must change in Phase 1.** A new provider account may legitimately have the same email as a legacy account. Rejecting it blocks the fresh-account policy; reusing the legacy row violates the no-linking rule. Preserve legacy uniqueness with a filtered index, and make external email a non-unique snapshot. Allow distinct trusted subjects with the same email to resolve distinctly. Update snapshots only through explicit account behavior; they never transfer expenses.

Use an additive preview migration: optional external identity fields, legacy-only password requirement, constraints preventing mixed credential kinds, identity uniqueness, and the revised email index. External accounts must not get fake password hashes. In Phase 6 remove credential storage in a new migration, retaining historical migrations and old account/expense rows as inert historical data unless a separately authorized reset occurs. Do not add a blanket non-null external-identity constraint that makes retained legacy rows impossible.

### Concurrent first login

Resolution should read the identity mapping, attempt creation when missing, and converge on the winner if the identity unique constraint is hit. Keep account creation and mapping in one transaction. Catch only the expected named unique violation; do not convert all database errors into duplicate identity outcomes. Roll back/detach failed tracked entities or use a new context before rereading. EF notes that insert uniqueness failures are provider-specific exceptions, not ordinary `DbUpdateConcurrencyException` cases. [EF Core concurrency documentation](https://learn.microsoft.com/en-us/ef/core/saving/concurrency).

An Infrastructure implementation may instead use a parameterized PostgreSQL conflict-handling statement, followed by a read. `ON CONFLICT DO NOTHING` with `RETURNING` does not return the existing row, so a losing transaction still needs a fresh read. Use the intended conflict target and a bounded retry policy. No process-local lock can prove correctness across API instances. [PostgreSQL INSERT / ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html).

After successful resolution, create an application-owned local-account claim. Do not trust a similarly named provider-supplied claim: remove/overwrite it and bind the principal to the configured scheme. `ICurrentAccount` reads this resolved identity in preview; legacy resolution remains scheme-specific. Preserve owner-filtered CRUD, foreign-ID NotFound, integer-grosz totals, and Warsaw dates unchanged.

## 5. Realm policy and hosted UI

### Configuration baseline

Use one application realm, separate from `master`, and one confidential browser client. Enable Standard Flow and enforce PKCE S256. Disable Direct Access Grants, implicit flow, unnecessary service accounts, and offline access. Register exact callback and logout URLs; browser-to-provider XHR/CORS is unnecessary for this redirect-only client. Set self-registration and email-as-username; disable duplicate emails, verification, recovery, and Remember me. Configure user profile so first/last name and a separate username are not requested. These are proposed settings to verify on the selected version. [Keycloak administration guide](https://www.keycloak.org/docs/latest/server_admin/).

The official downloads page advertised **Keycloak 26.8.1** when researched. Use it as the initial evaluation candidate, then pin the tested image tag/digest and compatible theme/provider artifacts. Do not copy Aspire's default image tag or use `latest`; recheck patches before implementation. This research did not pull or execute the image. [Official downloads](https://www.keycloak.org/downloads).

### Password policy: use the built-in implementation

Set the realm password policy to `length(12) and maxLength(128)`. The pinned source contains both the minimum-length provider and maximum-length provider; `maxLength` is the maximum policy's configuration ID. A custom Java password policy is unnecessary for these two bounds. [Minimum-length implementation](https://raw.githubusercontent.com/keycloak/keycloak/26.8.1/server-spi-private/src/main/java/org/keycloak/policy/LengthPasswordPolicyProvider.java), [maximum-length implementation](https://raw.githubusercontent.com/keycloak/keycloak/26.8.1/server-spi-private/src/main/java/org/keycloak/policy/MaximumLengthPasswordPolicyProvider.java), [maximum-length factory](https://raw.githubusercontent.com/keycloak/keycloak/26.8.1/server-spi-private/src/main/java/org/keycloak/policy/MaximumLengthPasswordPolicyProviderFactory.java).

Both use Java string length, which aligns with existing C#/JavaScript UTF-16 length semantics. Test 11/12/128/129, supplementary Unicode characters, and whitespace-only passwords. The current application also rejects all-whitespace input; length alone does not establish that parity. Probe Keycloak's actual blank-input handling before deciding an extension is needed. Do not introduce composition rules or trim passwords silently. Keycloak owns hashing and credential validation after cutover.

### Email policy needs a runtime proof

Keycloak's pinned `DefaultAttributes` lowercases email/local usernames, but the inspected normalization method does not trim them. That source inspection alone does not prove the whole registration/login pipeline trims whitespace. Verify registration and login with outer whitespace, case variants, and concurrent duplicates against real Keycloak. A browser `.trim()` alone cannot establish server policy. [Pinned normalization source](https://raw.githubusercontent.com/keycloak/keycloak/26.8.1/server-spi-private/src/main/java/org/keycloak/userprofile/DefaultAttributes.java).

If the probe fails, implement narrow provider-side normalization before profile validation/creation and in the login path. Use a supported extension point, not direct Keycloak database edits. Keep the application `EmailAddress` acceptance rules in view: it caps length at 254 and requires a dotted host. Either configure provider policy to the same supported envelope or document an explicit product decision; do not let registration succeed only for local provisioning to reject the email later. Include non-ASCII whitespace/case cases where .NET and Java normalization can differ.

### One visible password field is feasible

Keycloak 26.8.1's registration action compares `password` with `password-confirm`; simply deleting the second control fails server validation. Keycloakify exposes `doMakeUserConfirmPassword`, and its field rendering hides the confirmation field when false. Verify that the selected version synchronizes the submitted confirmation value, including password-manager autofill. If custom HeroUI rendering replaces that helper, preserve the provider form contract explicitly. Both values go only to Keycloak, with no extra user input or password storage. [Registration validator](https://raw.githubusercontent.com/keycloak/keycloak/26.8.1/services/src/main/java/org/keycloak/authentication/forms/RegistrationPassword.java), [Keycloakify field rendering](https://raw.githubusercontent.com/keycloakify/keycloakify/main/src/login/UserProfileFormFields.tsx).

If “no confirmation field” means no second protocol parameter at all, that is a different requirement and would require a provider extension. The PRD's user-facing interpretation allows a single visible password control with the existing provider validation contract.

### Theme tooling comparison

| Option | Maintenance / parity | Recommendation |
| --- | --- | --- |
| Native FreeMarker + CSS | Small build surface; template overrides need upgrade review; React/HeroUI markup must be reproduced | Good fallback if a full parity spike proves inexpensive |
| Keycloakify + React | Reuses the team's skills and component recipes; adds theme packaging/build/version compatibility work | Preferred for the detailed parity contract |
| Stock theme with logo/color changes | Cheapest | Insufficient for this PRD's layout, fields, confirmation, and interaction requirements |

Keycloak supports themes containing templates, styles, scripts, messages, and images, and warns that overridden templates may need updating on upgrades. Keycloakify is third-party tooling that packages themes as JARs; it does not move credential processing into PocketLedger. [Official theme guide](https://www.keycloak.org/ui-customization/themes), [Keycloakify documentation](https://docs.keycloakify.dev/).

Suggested location: `src/PocketLedger.KeycloakTheme`, with its own locked npm package. Import existing `tokens.css` and shared mark from repository-owned sources at build time; avoid copying another palette. Extract only the presentation pieces that are actually needed, without importing the SPA router, authentication API, or production design-reference code. Generate/package a theme artifact separately from the application bundle. Pin the supported build toolchain, including any JDK/Maven requirements of the selected Keycloakify release. Compatibility with this repository's Vite/React/HeroUI versions remains a spike, not an established result.

Submit native forms to Keycloak-provided action URLs and use provider-generated login/registration links. Never reconstruct `login-actions` URLs or submit passwords through `fetch('/api/...')`. Preserve field names, hidden protocol data, provider escaping/sanitization, and security headers. Map provider errors into existing presentation patterns without exposing unsafe HTML. Pending-state code must not disable successful form fields before the browser serializes them.

For direct `/register`, initiate an ordinary protected OIDC transaction with `prompt=create` on the selected Keycloak version, rather than redirecting directly to an internal form action. [Keycloak registration-entry guidance](https://www.keycloak.org/docs/latest/server_admin/#_registration).

### Registration confirmation is the main customization risk

The backend can prove a code exchange succeeded, but cannot infer a **new Keycloak registration** from `mode=register`, a query flag, or “local account was just created.” An existing provider user logging into PocketLedger for the first time would satisfy the latter. The pinned registration action records a provider-side new-user authentication note, but that note is not automatically an OIDC claim. [Registration creation source](https://raw.githubusercontent.com/keycloak/keycloak/26.8.1/services/src/main/java/org/keycloak/authentication/forms/RegistrationUserCreation.java).

Recommended prototype: add a small provider FormAction after successful registration that schedules a PocketLedger confirmation RequiredAction. The action renders “You're all set.” using Keycloak's authenticated user email, and “View today's spending” completes the action and continues the same authorization flow. Account creation has succeeded, although the PocketLedger session is established only after the subsequent callback. Do not enable this as a blanket required action for existing users. Specify behavior if the user closes the page before continuing.

Keycloak documents FormAction and RequiredAction extension points. Package the provider against the pinned server version and the custom confirmation template with the theme. This is a small Java extension for truthful product flow, not a replacement credential system. Its upgrade/build cost is justified only by the strict confirmation requirement. An application-hosted confirmation would instead need a trustworthy, transaction-bound, one-use provider registration receipt; a browser flag is insufficient. [Server extension guide](https://www.keycloak.org/docs/latest/server_development/).

## 6. Aspire, persistence, and reproducible configuration

Use `Aspire.Hosting.Keycloak` if its package compatible with Aspire 13.5.4 exposes the required APIs. The integration is marked preview; inspect the exact NuGet version/API before selecting it. Its documented facilities include realm import, volumes, and readiness checks. `WithPostgres` belongs to `CommunityToolkit.Aspire.Hosting.Keycloak.Extensions`, not the official hosting package. Prefer a few explicit `KC_DB*` environment settings to adding a community dependency solely for convenience, unless its compatible version materially simplifies the model. [Aspire Keycloak integration](https://aspire.dev/integrations/security/keycloak/).

Recommended resource graph:

```text
existing postgres -> expenses -> API -> Vite web
new identity-postgres -> keycloak database -> Keycloak
Keycloak -> API authentication dependency
explicit-start tests -> disposable test-owned services, never developer data
```

Use a separate named PostgreSQL identity volume. PostgreSQL is supported by Keycloak, including version 17 used by current API tests. A Keycloak `/opt/keycloak/data` volume alone does not persist data stored in an external PostgreSQL server. The simpler persistent `dev-file` option is possible for local-only use, but separate PostgreSQL gives closer parity with the planned real-service tests and avoids a later database change. [Keycloak database configuration](https://www.keycloak.org/server/db).

Enable and validate `/health/ready`, normally on management port 9000. Do not equate an open main HTTP port or liveness with readiness. Check the integration's actual management endpoint and database readiness behavior for the pinned image. No `curl` installation inside the Keycloak image should be necessary for Aspire's host-side HTTP checks. [Health documentation](https://www.keycloak.org/observability/health).

For clean setup, import a versioned, user-free realm template. Keycloak supports environment placeholders for secrets. Startup `--import-realm` skips an existing realm, whereas the separate import command defaults to overriding it. Consequently, changing a committed import file does **not** upgrade an existing realm on ordinary restart. Add a versioned, explicit, idempotent Admin API reconciliation step for intended configuration changes; update only owned settings, never recreate users or reset credentials. [Realm import semantics](https://www.keycloak.org/server/importExport).

Keep bootstrap administrator password, confidential-client secret, and database credentials in Aspire secret parameters/user secrets. Preserve the AppHost UserSecretsId. Keep test seeding separate from the developer template and never commit real users/passwords or a realm export containing them. Stable persisted secrets must agree with a previously created realm; regeneration is not an implicit rotation procedure.

Use a stable public Keycloak issuer URL for interactive development. Browser-facing issuer URLs and backend DNS names must not be substituted for one another. A host-run API can use the published loopback endpoint; container-run tests need a planned network/backchannel route while keeping issuer validation exact. Keycloak's hostname configuration supports explicit frontend and backchannel behavior. [Hostname guidance](https://www.keycloak.org/server/hostname).

Preserve `pocketledger-postgres-data` and the explicit-start `tests` resource. Research requires no stack startup. Implementation must use the repository Aspire lifecycle skills and validate changed wiring through `aspire start`, resource readiness, logs, and cleanup of verification-only sessions.

## 7. HTTP boundary, proxying, and preview isolation

### Same-origin browser boundary

Continue making browser API calls through Vite's `/api` proxy. Put callback and sign-out paths under `/api/auth/...` so the proxy forwards them; the middleware defaults `/signin-oidc` and `/signout-callback-oidc` would miss today's proxy rule. These protocol callbacks are middleware-owned, while Start, Session, and Logout stay thin feature controllers.

Configure a validated browser-facing application origin and exact redirect URLs. Fix proxy host/scheme propagation deliberately; do not use arbitrary incoming `Host`, `Forwarded`, or return-URL input to construct security-sensitive destinations. Forwarded Headers Middleware must trust only the intended proxy. Preserve multiple `Set-Cookie` values through Vite. [ASP.NET Core proxy guidance](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0).

Prefer HTTPS for the preview/browser acceptance environment so correlation/nonce and session cookie behavior is realistic. A local HTTP exception, if needed, must be confined to explicit Development/Testing configuration and verified separately. Do not weaken global SameSite/cookie security to make the redirect appear to work. Trusting a development certificate is a documented setup dependency.

### Minimal proposed contract

Paths and payloads below are proposals; define the stable contract in Phase 1 so Phase 4 backend work does not force unplanned frontend changes.

| Operation | Proposed behavior |
| --- | --- |
| `GET /api/auth/start?intent=login|register&destination=today|design-system` | Explicit navigation challenges OIDC; map destination IDs to exact routes; design reference allowed only in Development |
| `/api/auth/callback` | Framework callback validates transaction, resolves local account, creates ticket, redirects safely |
| `GET /api/auth/me` | 200 with local account ID and needed display/session metadata; 401 when signed out; unavailable response on store failure; no token payload |
| `GET /api/auth/antiforgery` | Issues cookie/request-token pair for same-origin mutation requests; no-store |
| `POST /api/auth/logout` | Validates antiforgery, revokes local ticket, performs provider sign-out navigation |
| `/api/auth/signout-callback` | Validates framework logout state; returns to approved signed-out page |
| Authentication failure destination | Fixed application route with allowlisted failure code; never raw exception/provider text |

Use full-page navigation/native form submission for redirecting authentication operations; `fetch` cannot replace a top-level login/logout journey. If logout uses `fetch`, return a separately protected one-use navigation handoff rather than blindly following external redirects inside fetch.

Cookies require antiforgery protection on expense mutations as well as logout. Send a request token in an explicit header; validate it through MVC antiforgery integration. SameSite and CORS are supplemental, not substitutes. Bind authentication state/nonce/PKCE to the initiating browser, validate approved return destinations, and reject replay. [ASP.NET Core antiforgery](https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0), [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html).

### Temporary preview selection

During Phases 1–4, register named `LegacyBearer`, `PreviewCookie`, and `PreviewOidc` schemes. Avoid a policy that lists both schemes and merges identities, and avoid “try cookie, then bearer.” A concrete low-scope option is an explicit development-only request selector such as `X-PocketLedger-Auth: preview` on preview API fetches; the backend selects exactly one scheme, defaulting to legacy otherwise. The selector is routing information, never a credential. Reject unknown selector values and test requests carrying both credential types.

This keeps existing expense routes/handlers shared without implementing two expense APIs. Preview start/callback/logout routes use their explicit schemes; selected API authorization and `ICurrentAccount` agree on the scheme. A legacy bearer credential alone cannot authorize a preview request, and a preview cookie alone cannot authorize a legacy request. A header does not replace antiforgery. Phase 5 frontend may continue selecting the already-delivered preview contract while becoming the default; Phase 6 removes the selector and legacy backend. This respects the plan's later layer boundaries.

Return stable failure codes for `session_expired`, `authentication_cancelled`, `transaction_expired`, `authentication_failed`, and `provider_unavailable`. Show retry/return actions without automatic challenge loops. An API request receives 401/403/503 as appropriate, not Keycloak HTML. Provider failure before navigation can be handled by the backend; failure after navigation to an unreachable provider may show a browser network error. Document this limit and test recovery by returning to PocketLedger; no backend can render a branded page on an unreachable remote origin.

Exclude callback query strings, authorization codes/state, cookies, token request/response bodies, client secrets, and credential form values from logs/telemetry. Test normal/error HTTP logging and outgoing OIDC requests, not only application logger calls.

## 8. Verification strategy and phase refinements

### Repeatable real-service harness

Extend existing Docker-backed tests for account persistence, schema evolution, owner isolation, unique races, and session-store behavior. Add disposable Keycloak plus its own identity database. Run a network-reachable API/Vite host for browser journeys: the current in-memory `WebApplicationFactory` transport is not directly reachable by Playwright. Use a shared immutable realm template and per-run secrets, users, ports, application database, and key ring. No developer volume or secret injection into the test resource.

Retain a Playwright Test suite in the repository, with pinned package/browser installation and an explicit CI job/command introduced by the implementation. There is currently no `test:e2e` npm command; do not document it as existing. Keep the dashboard `dotnet test` runner's backend role clear and document the separate browser command. Use browser registration/login, never password grants. Reuse authenticated state only for non-authentication tests; full auth/logout tests must exercise the actual flow. Treat saved browser state as a credential. [Playwright authentication guidance](https://playwright.dev/docs/auth).

| Test group | Required evidence |
| --- | --- |
| Seeded login and restoration | Real code flow, stable local GUID after reload/API restart, owned total, no browser tokens |
| Registration policy | 11/12/128/129 password lengths, whitespace-only/Unicode probes, one visible password field, no required profile extras |
| Email uniqueness | Case/whitespace variants, concurrent duplicate attempts, original password still works after rejected duplicate |
| Identity provisioning | Concurrent first callbacks converge; opaque/non-GUID subjects resolve; same email never links to legacy ownership |
| Expenses | Two browser accounts; CRUD and today's totals isolated; foreign IDs remain NotFound |
| Callback security | Tampered/replayed state, missing correlation/nonce, wrong issuer/client audience/signature, expired transaction/code; no partial session |
| Credential isolation | Legacy token rejected by preview; cookie rejected by legacy mode; all bearer credentials rejected after retirement |
| Session/logout | Idle/absolute boundaries, renewal/logout race, replayed old cookie, both-session completion, Back/reload/other-tab behavior |
| Failure recovery | Provider unavailable at initiation/exchange/logout; cancelled callback; unavailable ticket store; retry without loops |
| Persistence/setup | Clean configuration, stop/restart identities/mappings/expenses, no user/credential changes on ordinary startup |
| Retirement | Old endpoints cannot issue credentials; old signing key unnecessary; no password column in current schema; retained data survives |
| UI | Original-design comparisons and full [mobile/accessibility matrix](learning/014-mobile-layout-and-accessibility.md#verification-and-its-limits), including error/pending/confirmation/logout screens |

Real Keycloak normally issues a particular subject format. Test opaque subjects in handler/database contracts using a validated-identity adapter, or a separately configured supported real-provider fixture if available; do not weaken JWT validation merely to inject a different subject. Distinguish this contract test from real-provider browser evidence. Wrong-issuer/audience callback tests can use isolated real realms/clients or controlled protocol fixtures in addition to normal Keycloak journeys; label their evidence accurately.

Disable credential-step traces/body logging by default; Playwright traces can contain submitted passwords, cookies, and protocol values. Capture sanitized evidence after authentication or produce narrowly filtered reports. Ignored output is still sensitive and must not become a CI attachment containing credentials. Screenshot review must not automatically bless a new provider layout as the visual baseline.

### Changes to clarify before implementing the existing phases

| Phase | Recommended refinement |
| --- | --- |
| 1 | Resolve session/token/logout policy, preview selector, proxy/HTTPS origin, email-index migration, and theme compatibility. Include baseline cookie/CSRF/callback safety immediately; Phase 4 extends it rather than introducing security for the first time |
| 2 | Use built-in `maxLength`; prove email normalization, blank-password parity, concurrency, and compatibility with `EmailAddress`. Any provider-side correction needs a real failing reproduction |
| 3 | Implement the provider-backed confirmation and complete hosted UI parity. Account for Java/provider packaging explicitly if the spike confirms it is needed |
| 4 | Complete hardening and failure contracts already shaped in Phase 1; cover local/provider session differences and logout concurrency |
| 5 | Switch frontend default, restore via `/api/auth/me`, clear protected content on expiration/logout/history restoration, preserve development-only reference |
| 6 | Remove legacy schemes/endpoints/verifiers/index rules/signing-key startup requirement; preserve old ownership rows and migration history |
| 7 | Prove clean setup and configuration upgrades as well as restart; run backend and browser suites, dashboard test resource, visual validation, and C1–C19 audit |

Keep the plan's test-first gate. Infrastructure/fixture failure is blocked evidence, not a behavioral red test. Preserve already-green behavior and record the precise baseline, failing assertion, implementation change, and green rerun in focused learning notes.

## 9. Priority proofs and remaining uncertainty

The following are implementation-time proofs, **not completed experiments** in this research:

1. **Hosted UI toolchain:** package one branded login using pinned Keycloak 26.8.1 and the selected Keycloakify release with current React/Vite/HeroUI; verify native form submission and CSP. Fall back to FreeMarker only after assessing parity/maintenance cost.
2. **Policy parity:** real registration/login probes for whitespace/case email, boundary/Unicode/blank passwords, hidden confirmation synchronization, and user-profile requirements. Add only the provider extension demonstrated necessary.
3. **Truthful registration confirmation:** prototype the registration-only FormAction/RequiredAction chain and interruption/revisit behavior. Prove ordinary login cannot display a false account-created message.
4. **Session/proxy/logout:** complete a real HTTPS browser round-trip through Vite, validate cookie attributes/callback origins, restart API, then invalidate a captured session. Verify token-free provider logout and its confirmation UX.
5. **Installed Aspire compatibility:** identify the compatible preview hosting package and actual PostgreSQL/health/import APIs without upgrading the whole stack incidentally. Verify initial import and explicit non-destructive configuration upgrade.

Only after these proofs should the Phase 1 ADR freeze the design. Use the next ADR number available at that time; do not reserve one here. Update the existing plan only through a subsequent authorized edit if these findings change its tasks or acceptance interpretation.

## 10. Learning and documentation follow-through

This report is the research artifact. Implementation should add focused learning notes for: OIDC versus local sessions; provider identity versus aggregate identity; database uniqueness and concurrent provisioning; hosted form contracts; CSRF after moving to cookies; and reproducible identity infrastructure. Useful exercises include explaining why an ID token is not an API credential, reproducing the logout/renewal race, and proving why the same email must not transfer expense ownership.

Architecture implementation must update README/diagrams, root and frontend instructions, domain identity descriptions, design guide/examples, setup/reset procedures, and affected learning notes. Supersede only the replaced parts of authentication ADRs while retaining their history. A non-destructive cutover can retain legacy accounts/expenses as inaccessible historical rows; any deletion/reset must identify the exact data affected and require separate authorization. Volume persistence preserves bytes, not identity continuity if a realm is destroyed and recreated.

**Research validation:** repository files and linked primary documentation/source were reviewed. No containers, browser journeys, builds, tests, or compatibility spikes were run because this task produces a separate research document. The implementation and runtime claims above remain recommendations until their listed acceptance checks pass.
