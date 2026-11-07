# ADR 0019: Make the delivered cookie session the browser default

- Status: Accepted; verification evidence is tracked in learning note 021.
- Date: 2026-11-07
- Supplements ADRs 0014–0017 and supersedes their temporary browser preview/default split and ADR 0013’s bearer-based reference gate.

## Context

Phase 4 delivers bounded local sessions and API failure contracts. The browser still holds first-party bearer tokens in memory and offers a separate preview. Phase 5 must use the delivered session throughout, including reload, protected development examples, recovery and logout. The owner approved narrow backend support for HTML recovery and logout after local expiry; broader legacy retirement remains Phase 6.

## Decision

Remove browser credential forms, token state and the preview selector. `/login` and `/register` first verify the local session, then enter the hosted code flow if missing. A valid session opens today; `/design-system` returns through hosted login to that exact development-only destination. Preserve `/preview` as a compatibility destination for earlier provider transactions and retained regression tests, without a separate UI.

Continue selecting the delivered cookie scheme with `X-PocketLedger-Auth: preview`. Renaming backend schemes, enabling production configuration and removing legacy endpoints/password verifiers/JWT keys are outside this phase. Passwords travel only to native Keycloak form actions; no provider tokens are saved or sent to the frontend. Session lifetime remains 30 minutes sliding idle and eight hours absolute, with the existing bounded persistent HttpOnly cookie and protected PostgreSQL ticket.

`App` owns the session gate for today and the lazy development reference. Verify before mounting protected content; recheck every minute, on visibility and history restoration. Fail closed on malformed/unavailable responses. A non-secret `history.state.pocketledgerVerified` marker helps distinguish ended sessions on reload from first visits; it grants no access, is checked against the API, and stores no credentials. No localStorage/sessionStorage state is required. Unmount protected content before history snapshots and logout; abort abandoned requests, suspend polling after explicit session termination, and ignore results from older verification epochs. Preserve usable recovery on Back rather than an indefinite checking state.

Use feature-owned `SessionNotice`, built from existing `PageShell`/`Notice`/HeroUI patterns, for checking, verification failure, ended sessions, incomplete logout and bounded protocol failures. Never echo provider messages, callback code/state or arbitrary query text. Retry is explicit, preventing redirect loops. Failure URLs can carry only a fixed code and an exact `/design-system` continuation; root is the fallback. The same route in production never grants design-reference access.

The backend bridge retains Phase 4 status/JSON responses for API clients. A request explicitly accepting HTML instead receives a same-origin `/auth/recovery` redirect with an allowlisted code and safe continuation. Framework-owned state/correlation/nonce/PKCE validation remains unchanged. Registration uses the trusted Keycloak `/protocol/openid-connect/registrations` entry endpoint with the framework-generated transaction parameters; `kc_action=register` is not the supported registration entry mechanism.

Logout hides protected content before network work and posts an antiforgery-bound native form, allowing the provider navigation. `/api/auth/preview/logout-token` can supply a request token even after local expiry. The logout action allows an absent local principal, while still selecting named cookie authentication and validating antiforgery even for anonymous logout. Thus a valid local ticket is revoked, and an already expired ticket does not prevent ending provider SSO. The original authenticated antiforgery endpoint and cookie-authenticated expense mutation policy are unchanged. Disabled Keycloak configuration does not expose a functional logout/token flow. Provider confirmation remains necessary; provider outage cannot guarantee remote logout. Failed initiation stays hidden with retry and never claims success.

## Alternatives and costs

Keeping in-memory bearer state loses restoration and leaves two browser products. Storing tokens in browser storage changes the security boundary and is unnecessary. A second verification gate inside the reference duplicates lifecycle/race handling; the shared `App` gate protects both routes. A history marker is cheaper than adding a persistent browser credential or another backend expired-session classification endpoint, but cannot identify expiry across entirely new browsing histories.

Raw JSON is useful for API tests/clients but leaves document-navigation users without recovery. HTML negotiation adds a narrow presentation bridge, not new protocol validation. Permitting expired-session logout requires explicit anonymous CSRF testing; simply removing authorization without that validation would allow forged logout. Provider-side outage after a browser redirect remains subject to provider/network availability and cannot be conclusively diagnosed by the SPA.

## Data and deployment boundaries

No migrations, volume changes, account linking, data reset, AppHost wiring changes or production enablement occur. Legacy accounts/expenses remain independent from new issuer/subject accounts; matching email never transfers ownership. Preserve all volumes, keys and secrets. The local backend’s Development/Testing restriction remains until separately authorized enablement. Phase 6 removes the temporary legacy backend; Phase 7 proves final clean setup and persistence.

## Verification

See [learning note 021](../learning/021-default-browser-session.md) for the test-first baseline, retained real-service journeys, checks, visual review and remaining physical-device limits.

## Phase 6 supersession

[ADR 0020](0020-keycloak-credential-retirement.md) supersedes first-party credential storage/endpoints/JWT services and signing-key configuration, the dual-authentication selector, and the legacy-only email index. The default cookie path retains existing scheme/callback/cookie names. Legacy owner/expense rows remain inaccessible historical data. Earlier decisions and verification above retain their historical rationale.
