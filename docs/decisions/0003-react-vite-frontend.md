# ADR 0003: Scaffold the frontend with React, TypeScript, Vite, and HeroUI

- Status: Accepted
- Date: 2026-10-05

## Context

The application needs a simple mobile-friendly browser UI backed by the existing ASP.NET Core API. The owner selected React and HeroUI. The immediate task is an empty frontend foundation, before implementing budget screens.

## Decision

Create `src/PolandExpenses.Web` as a React single-page application with TypeScript and Vite. Install HeroUI v3 and Tailwind CSS v4, importing Tailwind before HeroUI styles. Use npm with a committed lock file and `npm ci` for repeatable installation. Retain the scaffold's Oxlint configuration and strict TypeScript checks.

The Aspire AppHost uses `Aspire.Hosting.JavaScript` and `AddViteApp` to start a `web` resource. Aspire owns its development port and checks `/` for readiness. The resource is independent of the API until a use case needs an API request.

## Consequences

TypeScript catches contract and component mistakes during development. Vite provides module reloads and a static production bundle. ASP.NET Core remains responsible for backend behavior; server-side rendering has no current product requirement.

The initial page is only a placeholder. Routing, data fetching, authentication, offline behavior, automated UI tests, and production hosting will be introduced with concrete requirements. The Vite development resource does not itself decide the production hosting topology.

HeroUI targets the browser. Responsive layouts can support iPhone browsers, but this scaffold is not a native iOS application. A PWA or native packaging decision requires a later explicit milestone.
