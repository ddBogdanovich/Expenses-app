# PocketLedger frontend

React + TypeScript + Vite login, registration and spending pages with HeroUI v3 and Tailwind CSS v4.

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
