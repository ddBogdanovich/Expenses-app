# Hosted authentication: presentation and trusted confirmation

## What changes in Phase 3

The explicitly selected Keycloak preview now offers branded login and email/password-only registration, mode switching, password visibility, password-manager hints/paste, pending feedback, repeated-submit protection, field errors, retained email on failure, and the original registration confirmation. Native forms submit only to the provider. The ordinary application login/registration remains the default.

The shared theme is still the Web production CSS and mark packaged by `npm run build:keycloak-theme`. Native fields must also supply the states expected by that CSS: for example, HeroUI's `.field-error` needs `data-visible="true"` to expand. Merely copying the class can leave a real error at zero height. Editing a field removes its own server error and description reference, preserving other errors and password help. Recovered history pages restore pending controls; readonly fields preserve credentials in native POST bodies, whereas disabled fields would omit them.

## Why confirmation needs a trusted source

A successful form submit is not proof of registration: the provider can reject a duplicate or invalid input. Likewise, `/preview?registered=true&email=...` is controlled by the browser. Keycloak already owns the authoritative creation result and stored email, so the confirmation is a **required action**: a provider-managed step before it returns the authorization code.

`PocketLedgerRegistration.success` runs after creation and binds the new user's ID to the current authentication session. `PocketLedgerRegistrationConfirmation` checks the binding before rendering and before continuation. The template reads `confirmationEmail` supplied from that authenticated user, with normal HTML escaping. “View today’s spending” posts back to the provider; only then does the existing callback create the local session and show the daily projection. This adds no password prompt or profile fields.

The owner approved this narrow provider/configuration support as an exception to Phase 3's frontend-only boundary. [ADR 0016](../decisions/0016-hosted-registration-confirmation.md) records the decision, alternatives, and costs. Account creation confirmation is not verification of email ownership. Abandoning the page leaves the provider account intact; a later login works normally. Server-side session/callback hardening and default cutover remain Phases 4–6.

## Test-first evidence

Branch base: `94ae20d63fb0748fb69f9dabf8b92e997ac69d69` (fresh `origin/main`, Phase 2). Before theme/provider changes, `hosted-experience.spec.ts` was added and run against a disposable Phase 2 stack. The original application account screens and inherited hosted registration were captured through Playwright MCP, with the original application confirmation used as the visual reference.

Baseline command: `E2E_BASE_URL=<disposable-web-origin> E2E_USER_EMAIL=preview@example.com npm --prefix tests/PocketLedger.E2E run test:external -- hosted-experience --timeout=15000`. All six original cases failed: missing login-to-registration link; missing exact account labels/interactions on the inherited form; no error focus/clearing; missing expected account submit/pending interaction; no preserved confirmation; 36px inherited controls below the 48px target. Direct MCP inspection also confirmed the unwanted confirmation-password field and provider-default layout. Missing dependencies were not counted as failures.

The final suite retains those scenarios, adds direct forged provider action and missing-creation-note rejection, and keeps earlier legacy login, code flow, API restart, CSRF, cookie replay, duplicate/race, and ownership regressions. Policy tests bypass client constraints deliberately so 11/129-character rejection still proves server policy; product interaction tests exercise the real native controls.

Corrections during verification:

- Removed duplicated required markers after observing that shared CSS already renders them.
- Added the native field-error visibility state after the real-provider run exposed hidden messages.
- The pending test originally waited for a document navigation that it deliberately held. It now reads the in-flight DOM directly, checks the pending label/disabled/busy state, attempts a second submit, and counts one real POST before releasing it.
- The negative existing-user test initially expected a provider error page. Keycloak rejects the required action through the already implemented callback-failure redirect; the test now asserts that precise response, no confirmation, and a 401 local session.
- A fresh error-page check reproduced a restart loop without a valid transaction. The approved configured client return destination and a retained regression now cover recovery; unknown clients receive reopen instructions.

Repeat acceptance from the repository root:

```sh
npm run build:keycloak-provider
npm run build:keycloak-theme
npm --prefix tests/PocketLedger.E2E test
E2E_REALM_BASELINE=phase1 npm --prefix tests/PocketLedger.E2E test
npm test
npm run check:frontend
```

Final acceptance on 7 November 2026: current realm **18/18** (19.6s), retained Phase 1 realm **18/18** (21.4s). The later strengthening to actual clipboard paste was rerun separately. `npm test` passed **14/14** tooling/configuration regressions; `npm run check:frontend` passed strict TypeScript, production build, lint, and **28/28** frontend behavior tests. Provider Docker compilation and theme packaging passed. Aspire started successfully, completed owned-action/recovery-URL reconciliation, and reported the API healthy; the dashboard `tests` resource stayed `NotStarted`. The verification-only Aspire session was stopped. Configuration reconciliation is tested twice per disposable run; no developer users are used for browser acceptance.

## Visual and accessibility review

Playwright MCP captured login, registration, and confirmation across all ten viewports in [note 014](014-mobile-layout-and-accessibility.md#verification-and-its-limits), at 100% and 200% root text, with reduced motion and a dark device preference while retaining the explicit light theme. All 60 captures had one h1 and no horizontal page overflow. Form controls were at least 48px (96px at doubled text); confirmation actions grew with their labels. Screenshots were visually reviewed, including small-phone wrapping, enlarged tablet reflow, short-height scrolling, and desktop introduction/footer hierarchy. The original app screenshots remain the comparison, rather than accepting inherited provider styles as the baseline.

Temporary screenshots and contact sheets live only under ignored `output/playwright/phase3-*`. Credential-step traces and storage values are not published. Additional Playwright MCP checks exercised a 440×956 touch context through error recovery, registration, password reveal/hide, confirmation focus, continuation, and both-session logout. Login failure received focus; registration editing preserved the other field’s error; the held POST showed pending state and resumed to confirmation. Tab order was email → password → Show/Hide → submit, with a 3px keyboard focus outline. Contrast ratios were body 14.11:1, muted 5.36:1, primary 9.67:1, error 6.42:1, field boundary 3.21:1, and focus 5.81:1. Provider error screens were rechecked at desktop/large phone/small phone/landscape and 200% text after the recovery/focus fixes. No unresolved browser or UI/UX findings remain.

UI/UX review uses the project-local guidance for labels, connected errors, focus, touch targets, pending feedback, text reflow, and the accepted design contract. Physical iPhone Safari, actual keyboard/password-manager behavior, safe-area hardware, and VoiceOver remain device follow-up limits, not claims proved by Chromium.

## Exercise

1. Why does a stored email on a provider account prove a different fact from verified email ownership?
2. Trace the new account ID from `RegistrationUserCreation` through the authentication-session note, required action, OIDC callback, and local issuer/subject mapping. Where would a forged query flag be rejected?
3. Explain why disabling credential inputs before a native POST breaks submission, while disabling the submit button and using readonly fields does not.
4. Assign the confirmation action to an existing disposable user without its registration note. Why must the action fail even after a correct password?

## Phase 4 contract supplement

Phase 3's callback-failure redirect evidence above records the behavior at that milestone. Phase 4 replaces it with bounded backend JSON responses; the retained existing-user rejection test now asserts `auth.cancelled`, no confirmation, and no local session. The creation-note invariant is unchanged. See [learning note 019](019-session-security-and-failure-contracts.md) and [ADR 0017](../decisions/0017-bounded-authentication-failures.md).

## Phase 5 update

The implementation details above record the original milestone. [Learning note 021](021-default-browser-session.md) describes the current browser: hosted Keycloak entry, cookie-session restoration in `App`, protected reference access, recovery and logout. Legacy frontend credential forms and token state are removed; legacy backend retirement remains Phase 6. Preserve the historical verification evidence above.
