# Learning note 011: Registration from browser to API

## Components and state

`src/PocketLedger.Web/src/features/authentication/AccountPage.tsx` composes HeroUI form controls. A `TextField` connects its label, input, help text, and validation error for assistive technology. `useState` holds entered values and visible submission state. A ref blocks repeated submissions immediately, before a render updates the button. The password can be revealed through a keyboard-accessible button and uses `new-password` autocomplete.

HTML email validation and the named frontend `passwordPolicy` provide immediate feedback. They improve usability; the backend still validates every request and enforces unique emails. No name, currency choice, or password composition rules are added to the established contract.

## HTTP is a boundary

`auth-api.ts` sends `{ email, password }` to `POST /api/auth/register`. TypeScript cannot prove the runtime response is valid, so the client checks for 201 and a nonempty string access token. Duplicate email (409), invalid input (400), unexpected responses, and network failure produce recoverable messages. Passwords are never trimmed; surrounding email whitespace is trimmed.

Successful registration clears the password and holds the token in React memory. A reload loses it. Browser storage would survive reload but persist a bearer credential; cookies would require backend support and a separate authentication decision. The success screen lets the user continue to [today’s spending](012-login-and-daily-spending.md) using that token.

## Why a proxy?

A proxy forwards a request to another server. The browser sends `/api/auth/register` to its own origin. Vite forwards the request to the API endpoint supplied by Aspire as `API_BASE_URL`; `web` waits for API health. This removes development CORS setup and hardcoded Aspire ports. Standalone Vite uses the existing API HTTP profile at `http://localhost:5187` unless overridden.

The proxy only exists during development. A deployed frontend needs a web host or gateway routing `/api` to the backend on the same origin. `dist` alone cannot do this. No production topology is implemented here.

## Verification and exercise

From `src/PocketLedger.Web`, run `npm ci`, `npm test`, `npm run build`, and `npm run lint`. Vitest, Testing Library, and jsdom exercise observable UI behavior with controlled HTTP outcomes. With Aspire and Docker running, submit a fresh email and verify account creation, then reuse that email to verify conflict feedback. These real requests persist accounts in the development database.

1. Why can a successful HTTP status still contain an unusable response?
2. What happens to the access token after a browser refresh?
3. Change a mocked response from 201 to 409. Explain why the form should stay editable.
4. Why does production still need `/api` routing after Vite builds successfully?

## Recoverable errors and readable controls

Registration retains the server error as one object containing its message and optional field. Editing the password leaves an email conflict visible; editing the email clears that conflict. This avoids separate message and field-error state drifting apart. General request errors clear when the user edits either field or retries.

The request uses an `AbortController` with the shared `requestTimeoutMs` (15 seconds). The deadline covers response headers and reading the response body; `finally` clears the timer. An aborted request releases the form and offers retry feedback. Cancellation cannot undo an account already saved on the server, so the timeout message acknowledges that account creation may have succeeded. Tests use a controlled clock to verify both stalled headers and a stalled body without waiting in real time.

Inputs use 16px text, with larger labels and supporting copy. Inline errors and invalid field labels use the same darker error token as the form-level alert, keeping their text readable against the white card. These changes preserve the minimal layout while prioritizing reading and recovery over decorative compactness.

## Shared design patterns

The account page now composes `PageShell` for its frame and `Notice` for informational session messages and request failures. Form controls retain HeroUI behavior, with `.ledger-form`, `.ledger-input`, and `.primary-action` recipes and centralized theme tokens. See the [design guide](../design/README.md) and [Learning note 015](015-frontend-design-system.md).

## Phase 5 update

The implementation details above record the original milestone. [Learning note 021](021-default-browser-session.md) describes the current browser: hosted Keycloak entry, cookie-session restoration in `App`, protected reference access, recovery and logout. Legacy frontend credential forms and token state are removed; legacy backend retirement remains Phase 6. Preserve the historical verification evidence above.
