# 019 — Sessions, protocol boundaries, and bounded failures

## The problem

A login can fail after the user leaves PocketLedger: the provider can stop responding, a callback can be replayed, or a transaction cookie can expire. The frontend needs a finite response it can interpret without starting another automatic login. Expense responses also need cache protection when authentication rejects the request before a controller executes.

Phase 4 hardens the explicitly selected preview. Default JWT login remains current. See [ADR 0017](../decisions/0017-bounded-authentication-failures.md) and the [implementation plan](../plan-keycloak-authentication.md).

## Session lifetime and restoration

The cookie contains a protected reference to a protected PostgreSQL ticket, not provider tokens. A valid session survives reload, revisits, and API restart with the same data-protection keys. Browser close does not mean logout. Activity renews the idle deadline after the cookie middleware's sliding threshold, but never moves the original eight-hour absolute deadline. An idle session expires after 30 minutes.

The test clock advances time without waiting eight hours. `PreviewSecurityTests.RestoredSessionSlidesButNeverOutlivesAbsoluteExpiryAsync` sends authenticated HTTP requests every 20 minutes through the real cookie middleware and PostgreSQL store, then proves rejection at eight hours. `IdleSessionExpiresAndCannotBeRenewedAsync` proves rejection at 30 minutes. Existing ticket tests prove logout cannot be undone by a late renewal. Real-browser tests prove login/reload/API restart and both-session logout using disposable Keycloak and databases.

Provider token renewal is deliberately absent: there are no saved tokens to refresh. This reduces credential custody but means provider outages and administrator changes do not immediately invalidate an existing local session. Local expiry and explicit logout bound that exposure. Adding provider-driven revocation would be a separate design choice.

## Protocol validation versus application policy

ASP.NET Core owns state protection, correlation/nonce cookies, issuer/audience validation, and PKCE. A random `state` value cannot authenticate a caller. A valid callback cannot be replayed after correlation has been consumed. `returnUrl` is application policy: only `/preview`, `/`, and `/design-system` are allowed, with exact matching and no nested queries. The route still performs its own authorization.

Keycloak supports pushed authorization requests. In that mode PKCE parameters are sent over the confidential backchannel and the browser sees `request_uri`. Looking only for `code_challenge` in the browser URL would reject a valid, stronger protocol exchange. The HTTP test uses static metadata without PAR to verify the S256 challenge directly; real-provider tests exercise PAR and code-flow callbacks.

Cookie mutations still require antiforgery, including logout. A forged POST cannot revoke or modify a session. Passwords go only to Keycloak. Local identities remain exact issuer/opaque-subject mappings, never email links. Independent bearer tests reject missing, expired, wrong-signature, wrong-issuer, and wrong-audience credentials; browser regressions cover tampered/replayed session cookies and default/preview isolation.

## Failure and cache contracts

The [ADR response table](../decisions/0017-bounded-authentication-failures.md#decision) specifies the stable JSON codes. Invalid sessions yield 401 without a login redirect. Failed callbacks return 400; unavailable provider calls return 503. These responses contain no provider descriptions, codes, state, cookies, or secrets. The frontend's recovery presentation belongs to Phase 5; Phase 4 leaves its screens unchanged.

Provider HTTP 5xx requires care: a protocol library may turn an HTTP error into a parsing/protocol exception instead of a transport exception. `PreviewProviderHandler` classifies server failures before protocol parsing. Tests switch a disposable provider proxy to HTTP 503 to cover initial authentication and code exchange while demonstrating that a valid local session remains usable.

`UseAuthenticationBoundary` runs before authentication and authorization. Its `OnStarting` callback adds `no-store, private` to authentication/expense responses, including rejected requests. Placing this only after authorization misses 401 responses. Browser-rendered content and Back-button behavior remain frontend work.

Raw OIDC logging is disabled because even an exception can contain the provider's untrusted `error_description`. HTTP callback request logging remains suppressed and OpenTelemetry keeps query redaction. The tests inspect response content, captured formatted messages plus exceptions, real API logs, and OTLP traces exported by the separate API process against per-run secret markers. Ignored artifacts can still contain sensitive test infrastructure details; do not publish them.

## Test-first evidence

Baseline: `547e0265e78f0d30759be00b52b50f9077de4535` (`origin/main`, Phase 3), on `codex/phase-4-session-hardening` with only the new test fixtures before product changes.

| Scenario | Baseline result | Reason |
| --- | --- | --- |
| New `PreviewSecurityTests` (16 cases) | 11 failed, 5 passed | Three missing cache headers; four unchecked return destinations; provider outage escaped; three callbacks redirected instead of bounded JSON. Approved PKCE challenges and existing idle/absolute lifetime passed. |
| New real-provider browser security cases | Missing cache headers reproduced | Callback and expired-session responses lacked cache protection. The initial cancellation test incorrectly assumed PKCE was in the browser URL; it was corrected to capture the real callback because PAR is used. That mistaken assertion is not missing-feature evidence. |
| Initial fixture preparation | Not counted as red | Analyzer errors and an unintended static-metadata network request were fixed before the 16-case behavioral baseline. |

Commands:

```shell
dotnet test tests/PocketLedger.Api.Tests --filter FullyQualifiedName~PreviewSecurityTests --artifacts-path .artifacts/phase4
dotnet test PocketLedger.slnx --artifacts-path .artifacts/phase4
npm --prefix tests/PocketLedger.E2E test
E2E_REALM_BASELINE=phase1 npm --prefix tests/PocketLedger.E2E test
dotnet format PocketLedger.slnx --no-restore --verify-no-changes
```

Final verification on 7 November 2026:

- Backend suite: **109/109** (Domain 22, UseCases 3, API 84), including all **16/16** new HTTP security cases. Secret-redaction acceptance additionally requires an exported callback trace, so an empty telemetry capture cannot pass.
- Real Keycloak browser suite: **23/23** with the current realm and **23/23** with a retained Phase 1 realm. Later assertion strengthening also proves local logout remains effective during a provider outage. Real-provider wrong-PKCE rejection and ID-token API rejection were verification-only extensions of existing framework/isolation behavior and already passed; no artificial red was introduced.
- Root tooling/configuration regressions: **14/14**. C# formatting verification passed. No frontend production source, theme, provider build, dependencies, or AppHost wiring changed.
- Aspire: API, both PostgreSQL services, Keycloak, and Web healthy; owned configuration finished successfully; `tests` stayed `NotStarted`. API logs showed successful startup and no pending migrations. Verification-only Aspire was stopped, retaining all volumes.
- Playwright MCP: real hosted login, reload restoration, empty localStorage/sessionStorage, both-session logout/reload, fresh provider password prompt, 401 local access after logout, and bounded 400 invalid-callback response passed. Desktop 1440×1000 and phone 440×956 screenshots were captured and visually inspected, with no horizontal overflow or changed presentation. The initially occupied MCP profile was released with explicit owner permission. No UI code changed, so the Phase 3 full visual/text/accessibility matrix remains the visual baseline; this phase does not claim new physical iPhone evidence.
- At revision `b627ab2`, a hosted duplicate run exposed a test-fixture race: an in-process activity listener could observe no tags while multiple HTTP test hosts configured process-wide instrumentation. The assertion was replaced with a disposable OTLP HTTP/protobuf receiver attached to the real API process. Acceptance requires the final sentinel callback’s exact W3C trace ID as a flush barrier, callback-path evidence, and absence of actual code/state/session-cookie values and secret sentinels in exported trace payloads and API logs. This strengthens the observable contract without depending on other test hosts.
- Independent code review found no unresolved issues after fixing provider HTTP 5xx classification before protocol parsing.

Browser fixtures initially needed two corrections beyond the documented PAR assumption: intercept the provider response issuing a callback redirect, rather than a later hop in the redirect chain; and clear provider SSO cookies between independent cancellation transactions. The earlier existing-user confirmation rejection assertion now checks the intentionally changed bounded backend contract while retaining its no-confirmation/no-local-session invariants. These fixture updates do not weaken authentication acceptance.

The retained E2E harness uses disposable services, an authenticated loopback control endpoint, and a disposable HTTP fault proxy. Session expiry only updates its disposable database. No developer accounts, volumes, or secrets are changed.

## Exercise

1. Why does a 401 response need `no-store` even though it contains no expenses?
2. Follow a request finishing after logout. Why must renewal update an existing row instead of inserting a replacement?
3. Compare an idle deadline to an absolute deadline after six hours of active use. Which may move?
4. Return HTTP 503 from the disposable provider during code exchange. Verify local access is not created and the response contains only the documented error contract.
5. Explain why a provider logout confirmation must finish before claiming its SSO session ended, even though PocketLedger has already revoked its own ticket.

## Phase 5 update

The implementation details above record the original milestone. [Learning note 021](021-default-browser-session.md) describes the current browser: hosted Keycloak entry, cookie-session restoration in `App`, protected reference access, recovery and logout. Legacy frontend credential forms and token state are removed; legacy backend retirement remains Phase 6. Preserve the historical verification evidence above.
