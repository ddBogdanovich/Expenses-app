# PocketLedger frontend

React + TypeScript + Vite login, registration and spending pages with HeroUI v3 and Tailwind CSS v4.

Phone layouts prioritize the account form and daily total, with safe-area padding, scalable input text, and touch targets of at least 48 CSS pixels. See [Mobile layout and accessibility](../../docs/learning/014-mobile-layout-and-accessibility.md) for the responsive checks and physical-device follow-up.

Read the [design guide](../../docs/design/README.md) and [frontend instructions](AGENTS.md) before UI work. Theme values live in `src/styles/tokens.css`; `src/ui` supplies `PageShell` and `Notice`. Feature presentation such as `features/today/SpendingSummary.tsx` stays with its feature. HeroUI controls are used directly with shared form styles. Light mode and the native system font stack are explicit.

Sign in on the Vite development endpoint and select **Design reference** in the header to inspect the theme, buttons, validation, pending/disabled forms, notices, and spending-summary states. Signed-out visits to `/design-system` go to login, then continue to the reference after authentication. The route verifies the bearer session through `GET /api/auth/me` before showing examples and on visibility/every minute; unavailable verification hides them and offers retry. Back to today and browser history preserve the in-memory session; logout or a reload requires login again. Examples use local state and sample data without API calls; access verification uses the API. The reference is lazy-loaded only in development and absent from production output (`npm run preview` serves the normal app). See [Learning note 015](../../docs/learning/015-frontend-design-system.md) and [ADR 0013](../../docs/decisions/0013-code-backed-frontend-design-system.md). Changes to shared patterns require updating their examples and the guide, plus final Playwright MCP and UI/UX skill validation under the root instructions.

From this directory:

```sh
npm ci
npm run build
npm run lint
npm test
```

Run the full application through Aspire from `../../PocketLedger.AppHost` using `aspire start --non-interactive`, then open the `web` resource in its dashboard. For frontend-only work, `npm run dev` starts Vite independently.

See [Learning note 003](../../docs/learning/003-react-frontend-foundation.md) and [ADR 0003](../../docs/decisions/0003-react-vite-frontend.md). Registration calls `POST /api/auth/register` and retains the returned token in memory until reload. Login at `/login` opens the protected main page at `/`, which reads `GET /api/expenses/today` and formats the exact amount in PLN. See [Learning note 012](../../docs/learning/012-login-and-daily-spending.md).

Vite proxies `/api` to `API_BASE_URL`, supplied dynamically by Aspire. For standalone development, it defaults to the API launch profile at `http://localhost:5187`; set `API_BASE_URL` to override. This variable is used by the development server and is not bundled into browser code. Production hosting must serve the app entry point for `/`, `/login`, and `/register`, and route `/api` to the backend on the same origin; Vite’s development proxy is not included in `dist`.

## Development Keycloak preview

The default login/registration behavior above remains unchanged. **Try Keycloak preview** starts hosted login for a user created in the local Keycloak realm; `/preview` restores its independent cookie session and reads today’s spending with the explicit preview selector. Logout requires CSRF verification and completes through a branded provider confirmation. Browser close does not explicitly log out; the session expires after 30 minutes idle or 8 hours absolute. Provider access/refresh tokens are never stored by this UI. The development preview and design reference are excluded from production imports.

See root setup instructions, ADR 0014, and learning note 016. Run `npm run build:keycloak-theme` at the repository root after CSS changes. Native hosted templates consume compiled styles; they do not embed the SPA or forward passwords to the API. Account columns also respond to a named content-width container so enlarged text retains a usable form.
