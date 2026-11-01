# Poland Expenses

A personal budgeting application built to make a rolling daily allowance easy to understand and use. It is also a guided learning project for domain-driven design, React, ASP.NET Core, messaging, and Kubernetes.

## Current milestone

Feature 1 implements email/password registration and login with signed, 30-minute JWT access tokens. Accounts are persisted in PostgreSQL through a framework-independent DDD account aggregate and EF Core repository. The React frontend remains a placeholder; authentication screens and budget features are planned.

See [authentication contracts and tests](docs/learning/005-authentication-tests-first.md), [the DDD implementation guide](docs/learning/006-account-authentication.md), and [ADR 0005](docs/decisions/0005-account-authentication.md).

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
- Docker Desktop or another running Aspire-compatible container runtime for PostgreSQL

## Run the tests

```shell
dotnet test PolandExpenses.slnx
```

HTTP tests require Docker and start a disposable PostgreSQL 17 container. They apply real migrations and cover API restart persistence, duplicate registration races, and bearer-token validation. They never use the developer database.

See [docs/domain-model.md](docs/domain-model.md) for the current rules and worked examples.

## Architecture

The backend is a modular monolith with a clean domain core and vertically organized use cases:

```text
Domain <- UseCases <- Infrastructure <- Api <- AppHost
```

- `Domain` owns business language and invariants.
- `UseCases` owns feature handlers and ASP.NET Core controllers inside each vertical slice.
- `Infrastructure` implements account persistence with EF Core/Npgsql, password hashing, JWT signing and validation. Messaging and expense query services are planned.
- `Api` composes the application.
- `AppHost` runs and observes local resources.
- `Web` is an independent browser frontend; Aspire starts its Vite development server alongside the API.

Read [ADR 0002](docs/decisions/0002-clean-domain-with-vertical-use-cases.md) for dependency boundaries and [ADR 0006](docs/decisions/0006-controllers-and-named-policies.md) for controllers and named policy values.

## Learning workflow

Each implementation step follows the same loop:

1. Name the product or design problem.
2. Explain the relevant concept and its alternatives.
3. Implement one small example together.
4. Complete a focused exercise.
5. Review the result and record the decision.

Start with [Value objects and Money](docs/learning/001-value-objects-and-money.md), continue to [Project foundations and vertical slices](docs/learning/002-project-foundation-and-vertical-slices.md), then complete [Exercise 001](docs/exercises/001-rolling-allowance.md).

## Local orchestration

Aspire is the development composition root from the first milestone. The AppHost starts the API, the `web` frontend, and the `postgres` server with an `expenses` database. The API references and waits for `expenses`; `web` remains independent. A generated secret signing-key parameter is passed to the API and persisted in AppHost user secrets. Aspire installs frontend dependencies with `npm ci` and checks readiness. The API exports OpenTelemetry; process logs and resource state are visible in the dashboard.

```shell
cd PolandExpenses.AppHost
aspire start
```

Open the dashboard URL printed by Aspire, then open the `web` resource endpoint. The API exposes development health endpoints at `/health` and `/alive`. Frontend API integration and browser telemetry will be introduced with a real feature.

PostgreSQL uses a Docker volume so database contents survive `aspire stop` and subsequent starts. Its container uses the default session lifetime and stops with the AppHost. Aspire manages the local credentials and host port; use the dashboard's `expenses` connection string to connect with a database client. Do not commit credentials. A volume is not a backup.

The API calls `AddPostgresPersistence` and applies versioned account migrations automatically in Development and Testing. Other environments require migrations to be applied separately before startup. Outside Aspire, configure `ConnectionStrings__expenses` and a random `Jwt__SigningKey` of at least 32 bytes through environment variables or secrets; no production key is committed. Optional `Jwt__Issuer` and `Jwt__Audience` default to `PolandExpenses` and `PolandExpenses.Web`.

The HTTP contract is `POST /auth/register` (201), `POST /auth/login` (200), each accepting `{ "email": "...", "password": "..." }` and returning `{ "accessToken": "..." }`. `GET /auth/me` requires a valid bearer token and returns its account ID. Registration requires 12–128 password characters, defined centrally by `PasswordPolicy` in the authentication slice. Invalid input returns 400, invalid credentials 401, duplicate email 409.

Generate reviewed deployment SQL from the repository root:

```shell
dotnet ef migrations script --idempotent --project src/PolandExpenses.Infrastructure --output /tmp/poland-expenses-migrations.sql
```

The EF tool is installed separately (`dotnet tool install --global dotnet-ef --version 10.0.11`). Supply database credentials through your deployment secret mechanism when applying SQL. Development migration convenience is not a production rollout strategy. See [Learning note 004](docs/learning/004-postgresql-and-ef-core.md) for persistence concepts and [Learning note 006](docs/learning/006-account-authentication.md) for authentication boundaries and limits.
