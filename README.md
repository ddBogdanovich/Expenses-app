# Poland Expenses

A personal budgeting application built to make a rolling daily allowance easy to understand and use. It is also a guided learning project for domain-driven design, React, ASP.NET Core, messaging, and Kubernetes.

## Current milestone

Milestone 1 establishes the domain language and the application foundation. The solution contains the domain model, strict repository-wide build rules, an ASP.NET Core API, shared Aspire service defaults, and an empty React frontend. The AppHost orchestrates both the API and frontend. Persistence and product screens will be added with the first feature that needs them.

## Frontend

`src/PolandExpenses.Web` contains a React and TypeScript application built with Vite, with **HeroUI v3** and Tailwind CSS v4 installed. It currently displays a simple placeholder; budget screens and API calls are still planned.

To install dependencies and verify the frontend:

```shell
cd src/PolandExpenses.Web
npm ci
npm run build
npm run lint
```

Read [Learning note 003](docs/learning/003-react-frontend-foundation.md) for the purpose of each tool and [ADR 0003](docs/decisions/0003-react-vite-frontend.md) for the technology choices.

## Prerequisites

- .NET SDK 10
- Aspire CLI 13.5 or later
- Node.js 24 LTS and npm (the installed Vite version requires Node.js 20.19+ or 22.12+)

## Run the tests

```shell
dotnet test
```

See [docs/domain-model.md](docs/domain-model.md) for the current rules and worked examples.

## Architecture

The backend is a modular monolith with a clean domain core and vertically organized use cases:

```text
Domain <- UseCases <- Infrastructure <- Api <- AppHost
```

- `Domain` owns business language and invariants.
- `UseCases` owns feature handlers and HTTP endpoint modules.
- `Infrastructure` will implement aggregate repositories, query services, messaging, and integrations.
- `Api` composes the application.
- `AppHost` runs and observes local resources.
- `Web` is an independent browser frontend; Aspire starts its Vite development server alongside the API.

Read [ADR 0002](docs/decisions/0002-clean-domain-with-vertical-use-cases.md) for the decisions and tradeoffs.

## Learning workflow

Each implementation step follows the same loop:

1. Name the product or design problem.
2. Explain the relevant concept and its alternatives.
3. Implement one small example together.
4. Complete a focused exercise.
5. Review the result and record the decision.

Start with [Value objects and Money](docs/learning/001-value-objects-and-money.md), continue to [Project foundations and vertical slices](docs/learning/002-project-foundation-and-vertical-slices.md), then complete [Exercise 001](docs/exercises/001-rolling-allowance.md).

## Local orchestration

Aspire is the development composition root from the first milestone. The AppHost starts the API and the `web` frontend, installs frontend dependencies with `npm ci`, and checks both resources for readiness. The API exports OpenTelemetry; Vite's process logs and resource state are visible in the dashboard.

```shell
cd PolandExpenses.AppHost
aspire start
```

Open the dashboard URL printed by Aspire, then open the `web` resource endpoint. The API exposes development health endpoints at `/health` and `/alive`. Frontend API integration and browser telemetry will be introduced with a real feature.
