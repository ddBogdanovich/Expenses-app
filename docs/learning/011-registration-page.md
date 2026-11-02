# Learning note 011: Registration from browser to API

## Components and state

`src/PocketLedger.Web/src/features/registration/RegistrationPage.tsx` composes HeroUI form controls. A `TextField` connects its label, input, help text, and validation error for assistive technology. `useState` holds entered values and visible submission state. A ref blocks repeated submissions immediately, before a render updates the button. The password can be revealed through a keyboard-accessible button and uses `new-password` autocomplete.

HTML email validation and the named frontend `passwordPolicy` provide immediate feedback. They improve usability; the backend still validates every request and enforces unique emails. No name, currency choice, or password composition rules are added to the established contract.

## HTTP is a boundary

`registration-api.ts` sends `{ email, password }` to `POST /api/auth/register`. TypeScript cannot prove the runtime response is valid, so the client checks for 201 and a nonempty string access token. Duplicate email (409), invalid input (400), unexpected responses, and network failure produce recoverable messages. Passwords are never trimmed; surrounding email whitespace is trimmed.

Successful registration clears the password and holds the token in React memory. A reload loses it. Browser storage would survive reload but persist a bearer credential; cookies would require backend support and a separate authentication decision. The current success screen truthfully stops at account creation because budget screens and browser login are still planned.

## Why a proxy?

A proxy forwards a request to another server. The browser sends `/api/auth/register` to its own origin. Vite forwards the request to the API endpoint supplied by Aspire as `API_BASE_URL`; `web` waits for API health. This removes development CORS setup and hardcoded Aspire ports. Standalone Vite uses the existing API HTTP profile at `http://localhost:5187` unless overridden.

The proxy only exists during development. A deployed frontend needs a web host or gateway routing `/api` to the backend on the same origin. `dist` alone cannot do this. No production topology is implemented here.

## Verification and exercise

From `src/PocketLedger.Web`, run `npm ci`, `npm test`, `npm run build`, and `npm run lint`. Vitest, Testing Library, and jsdom exercise observable UI behavior with controlled HTTP outcomes. With Aspire and Docker running, submit a fresh email and verify account creation, then reuse that email to verify conflict feedback. These real requests persist accounts in the development database.

1. Why can a successful HTTP status still contain an unusable response?
2. What happens to the access token after a browser refresh?
3. Change a mocked response from 201 to 409. Explain why the form should stay editable.
4. Why does production still need `/api` routing after Vite builds successfully?
