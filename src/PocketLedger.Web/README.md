# PocketLedger frontend

React + TypeScript + Vite login, registration and spending pages with HeroUI v3 and Tailwind CSS v4.

Phone layouts prioritize the account form and daily total, with safe-area padding, scalable input text, and touch targets of at least 48 CSS pixels. See [Mobile layout and accessibility](../../docs/learning/014-mobile-layout-and-accessibility.md) for the responsive checks and physical-device follow-up.

Read the [design guide](../../docs/design/README.md) and [frontend instructions](AGENTS.md) before UI work. Theme values live in `src/styles/tokens.css`; `src/ui` supplies `PageShell` and `Notice`. Feature presentation such as `features/today/SpendingSummary.tsx` stays with its feature. HeroUI controls are used directly with shared form styles. Light mode and the native system font stack are explicit.

Sign in on the Vite development endpoint and select **Design reference** in the header to inspect the theme, buttons, validation, pending/disabled forms, notices, and spending-summary states. Signed-out visits to `/design-system` go to login, then continue to the reference after authentication. The route verifies the cookie session through `GET /api/auth/me` before showing examples and on visibility/every minute; unavailable verification hides them and offers retry. Back to today, reload and revisit preserve a valid server-side session. Examples use local state and sample data without API calls; access verification uses the API. The reference is lazy-loaded only in development and absent from production output (`npm run preview` serves the normal app). See [Learning note 015](../../docs/learning/015-frontend-design-system.md) and [ADR 0013](../../docs/decisions/0013-code-backed-frontend-design-system.md). Changes to shared patterns require updating their examples and the guide, plus final Playwright MCP and UI/UX skill validation under the root instructions.

From this directory:

```sh
npm ci
npm run build
npm run lint
npm test
npm run test:coverage
```

Run the full application through Aspire from `../../PocketLedger.AppHost` using `aspire start --non-interactive`, then open the `web` resource in its dashboard. For frontend-only work, `npm run dev` starts Vite independently.

See [Learning note 003](../../docs/learning/003-react-frontend-foundation.md) and [ADR 0003](../../docs/decisions/0003-react-vite-frontend.md). Registration submits credentials only to Keycloak. Login at `/login` opens the protected main page at `/`, which reads `GET /api/expenses/today` and formats the exact amount in PLN. See [Learning note 012](../../docs/learning/012-login-and-daily-spending.md).

Vite proxies `/api` to `API_BASE_URL`, supplied dynamically by Aspire. For standalone development, it defaults to the API launch profile at `http://localhost:5187`; set `API_BASE_URL` to override. This variable is used by the development server and is not bundled into browser code. Future production hosting must serve the app entry point for `/`, `/login`, `/register`, `/auth/recovery`, and `/auth/signed-out`, and route `/api` to the backend on the same origin; Vite’s development proxy is not included in `dist`.

## Keycloak browser default

`/login` and `/register` start Keycloak-hosted Authorization Code + PKCE flows. The API stores a protected server ticket and supplies an opaque HttpOnly cookie; no browser bearer-token state remains. Valid sessions survive reloads and revisits, for up to 30 minutes idle and eight hours absolute. `/preview` remains a compatibility return destination, without a separate preview UI. The frontend retains the explicit `X-PocketLedger-Auth: preview` header until Phase 6 retires legacy backend authentication.

`App` verifies sessions before protected children mount and rechecks on visibility, page restoration and each minute. Missing sessions on first visits enter hosted login; a rejected previously verified entry offers login without a redirect loop. Failed checks offer retry while hiding protected content. `SessionNotice` renders bounded callback/provider/transaction recovery using shared `PageShell` and `Notice`. Only an allowlisted code and exact development-reference continuation reach the recovery URL.

Logout hides spending immediately, obtains a request-bound token from `/api/auth/preview/logout-token`, and posts to logout before provider confirmation. This token can be obtained after local session expiry; forged anonymous logout remains rejected. Provider completion is necessary to end SSO. A failed logout request is shown honestly with retry, rather than displaying protected content or claiming success. Session/history markers contain no credentials, localStorage and sessionStorage remain unused.

Hosted templates live under `infra/keycloak/themes/pocketledger`, consume production CSS/shared SVG, and post passwords only to Keycloak. Build the provider and theme at the repository root before startup. Confirmation proves provider account creation in its server-side transaction, not email ownership. See [ADR 0019](../../docs/decisions/0019-default-browser-session.md) and [learning note 021](../../docs/learning/021-default-browser-session.md). The backend currently enables this local milestone only in Development/Testing; production enablement and legacy removal are separate work.

## Coverage

`test:coverage` uses the repository's shared Vitest V8 scope and writes HTML/LCOV/JSON under `.artifacts/coverage/current/frontend` at the repository root. Unimported implementation files and development pages count; test/spec files and type declarations do not. The root pre-push/CI gate compares exact committed coverage against main and rejects line or branch degradation. See [learning note 020](../../docs/learning/020-coverage-and-regression-gates.md).
