# PocketLedger frontend

Empty React + TypeScript + Vite foundation with HeroUI v3 and Tailwind CSS v4.

From this directory:

```sh
npm ci
npm run build
npm run lint
```

Run the full application through Aspire from `../../PocketLedger.AppHost` using `aspire start --non-interactive`, then open the `web` resource in its dashboard. For frontend-only work, `npm run dev` starts Vite independently.

See [Learning note 003](../../docs/learning/003-react-frontend-foundation.md) and [ADR 0003](../../docs/decisions/0003-react-vite-frontend.md). Product screens, API calls, and production hosting remain future work.
