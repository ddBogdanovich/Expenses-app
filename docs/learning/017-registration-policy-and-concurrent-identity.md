# Registration policy and concurrent identity ownership

> Historical milestone note. [Learning note 022](022-credential-retirement.md) describes the current backend: Keycloak-only credentials, default protected cookie sessions, no first-party JWT endpoints/signing key or password storage, and retained legacy owner/expense rows. Code paths and commands below describing legacy credentials record the earlier implementation and are not current setup instructions.


## Why the provider and local account have separate jobs

Keycloak decides whether a person can register and whether a password is valid. PocketLedger decides which local account owns an expense. A provider email can change; `(issuer, subject)` remains the account lookup key. Normalizing registration email does not make it a safe expense ownership key or authorize linking to legacy accounts.

The provider extension in `infra/keycloak/provider/PocketLedgerRegistration.java` strips email whitespace and applies locale-independent lowercase. It also supplies an internal password-confirmation value so a server request needs only email/password. Keycloak's existing password action still checks `length(12) and maxLength(128)` and stores the verifier. Repeating those rules in the API would create competing credential authorities. A JavaScript-only workaround would leave non-scripted submissions with a different contract. See [ADR 0015](../decisions/0015-keycloak-registration-policy.md).

## A database constraint settles simultaneous first requests

Two requests can both see no local account. An application-level “does this exist?” check cannot prevent both inserts. PostgreSQL's unique issuer/subject index allows one winner. `UserAccountRepository.TryAddAsync` catches the expected uniqueness failure, clears failed tracked state, and the handler reads the winning account. Independent scoped DbContexts represent separate concurrent requests; sharing one DbContext would test unsupported concurrent EF use instead.

This behavior already existed in Phase 1. Phase 2 adds evidence rather than refactoring a working mechanism: 16 concurrent first resolutions return one GUID, an explicit pair of conflicting repository inserts gives one winner, and the losing scope can both read the winner and insert another identity. Same email/different issuer or differently cased subject yields separate local accounts. The existing migration/index is sufficient; no schema change is introduced.

## Reproducible configuration includes upgrades

`--import-realm` creates a missing realm but skips an existing one. `scripts/configure-keycloak.mjs` therefore reconciles the owned versioned flow/profile/policy before the API starts. It discovers subflows through parent executions (the top-level flow list excludes them), preserves provider users/passwords/client secrets, and does not edit built-in flows. Both fresh and retained Phase 1 fixtures run this reconciliation twice.

Build from the root with `npm run build:keycloak-provider` and `npm run build:keycloak-theme`. The provider compilation uses Docker and pinned dependencies, so no host Java/Maven install is needed. The internal form-action SPI carries an upgrade cost: rebuild and rerun real-provider tests when the Keycloak version changes. No messaging or new database technology is needed for this feature.

## Test-first record

Base: `78fec1b00dc649fb2f886ff052fd22092510950e`, freshly fetched `origin/main`, branch `codex/phase-2-keycloak-registration`.

1. Added `ExternalAccountTests.ConcurrentFirstRequestsResolveExactlyOneOpaqueIdentityAsync`, `IssuerAndCaseSensitiveSubjectDefineOwnershipIndependentlyOfEmailAsync`, and the explicit losing-insert test. `dotnet test tests/PocketLedger.Api.Tests --filter 'FullyQualifiedName~ExternalAccountTests|FullyQualifiedName~ExpenseTests' --artifacts-path .artifacts/phase2/baseline` passed 37 cases initially and 38 after adding the explicit conflict test. Already green: no missing provisioning behavior was manufactured.
2. Added `registration-policy.spec.ts` before realm/provider changes. The initial helper incorrectly assumed the final hosted-page URL was the original authorization URL. Corrected it to read the API's initial 302 and retain state/nonce/PKCE; that fixture error is not red evidence.
3. Reran `npm --prefix tests/PocketLedger.E2E test` against unchanged Phase 1 services. Both Phase 1 journeys passed. All seven new registration cases failed at the real provider's “Registration not allowed” response. This is the behavioral red gate; all infrastructure was running.
4. Added provider/configuration changes. A wrong unmanaged-profile enum blocked startup, and subflow discovery initially attempted duplicate creation. Corrected both from real provider responses; neither setup error counts as behavioral red evidence.
5. All four password boundaries and two-owner CRUD/totals passed. Corrected an expected-message mismatch: Keycloak says “already associated with an existing account.” A concurrent losing insert can render the provider's generic denial page rather than its registration form. The test's form-only assumption was inappropriate for this backend phase: retain one200/one401, no losing session, one stored normalized identity, rejected password denial, and successful winning credentials; defer branded recovery to Phase 3. No integrity assertion was removed.

## Final verification (2026-11-05)

- `npm --prefix tests/PocketLedger.E2E test`: **9/9 passed** against a fresh current realm (16.4 seconds of browser scenarios).
- `E2E_REALM_BASELINE=phase1 E2E_INSPECT=1 npm --prefix tests/PocketLedger.E2E test`: **9/9 passed** after upgrading the retained Phase 1 realm (14.8 seconds of browser scenarios). Both setup modes reconcile twice and retain the seeded user's credentials/subject. The concurrent and sequential duplicate tests verify exactly one provider identity through the protected test-only admin count control; the losing password cannot authenticate.
- `npm run check:backend`: restore/build (zero warnings/errors), **22 domain + 3 use-case + 68 API tests**, and formatting verification passed.
- `npm run check:frontend`: lint/build and **28/28 behavior tests** passed. `npm test`: **12/12 tooling tests** passed. Provider and shared theme builds passed.
- Aspire: started through `aspire start --non-interactive`; existing-realm import was skipped, policy reconciliation completed with exit 0, and `aspire wait api` / `aspire wait web` reported healthy. Keycloak logs showed successful 26.8.1 startup. The dashboard `tests` resource remained inactive; the full backend suite ran directly for this phase.
- Playwright MCP: the shared profile was occupied, so used an isolated MCP server/session without disturbing it. Inspected secret-free hosted login screenshots at 1440×1000 and 440×956, then completed a real email/password-only registration, saw zero spending, verified no horizontal overflow and empty browser token storage, and completed both-session logout. Screenshots under ignored `output/playwright/phase2-mcp/` were visually inspected. The one console 401 is the expected signed-out `/api/auth/me` request after logout. No application or hosted templates/styles changed, so the new-UI full matrix/skill gate does not apply to this backend-only phase; Phase 3 must still perform that complete review. Physical Safari/VoiceOver remain unverified.
- Independent read-only review found no Critical, Important, or Minor implementation findings. It confirmed that native concurrent-denial presentation belongs to Phase 3 provided ownership/credential assertions stay intact.

Verification-only Aspire and disposable inspection sessions are stopped after evidence collection; developer volumes and user secrets are retained.

## Scope and later phases

The default browser JWT flow stays intact. This phase changes no React or hosted templates. Provider registration is exercised through its supported OIDC endpoint; application entry links, the unnecessary inherited confirmation control, hosted styling, truthful confirmation, and recoverable error presentation remain Phase 3. Session/callback hardening remains Phase 4. Never treat a provider's generic race-denial page as successful registration.

## Exercises

1. Explain why a successful “find nothing” query does not make a later insert safe. Which invariant does the database protect?
2. Change only an existing identity's email in a test. Why must its local GUID remain unchanged? Why must the same email on another issuer not find that GUID?
3. Why does importing a current realm prove less than upgrading a retained Phase 1 fixture? Which kinds of state must reconciliation preserve?

## Phase 3 continuation

[Learning note 018](018-hosted-authentication-experience.md) records the delivered hosted forms, verified creation confirmation, error recovery, and review evidence. Phase 2 descriptions above remain historical; identity/credential policy and ownership invariants remain unchanged.
