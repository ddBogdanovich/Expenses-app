# PocketLedger

**PocketLedger** is a personal budgeting application built to make a rolling daily allowance easy to understand and use. It is also a guided learning project for domain-driven design, React, ASP.NET Core, messaging, and Kubernetes.

## Current milestone

Feature 2 implements backend expense CRUD for authenticated accounts, alongside registration and login with signed, 30-minute JWT access tokens. Accounts and expenses persist in PostgreSQL through framework-independent aggregates and EF Core repositories. Each account can access only its own expenses. The React frontend remains a placeholder; allowance calculations and browser features are planned.

See [the expense implementation guide](docs/learning/008-expense-aggregate-and-ownership.md) and [ADR 0007](docs/decisions/0007-expense-aggregate-and-api-prefix.md).

See [authentication contracts and tests](docs/learning/005-authentication-tests-first.md), [the DDD implementation guide](docs/learning/006-account-authentication.md), and [ADR 0005](docs/decisions/0005-account-authentication.md).

## Frontend

`src/PocketLedger.Web` contains a React and TypeScript application built with Vite, with **HeroUI v3** and Tailwind CSS v4 installed. It currently displays a simple placeholder; budget screens and API calls are still planned.

To install dependencies and verify the frontend:

```shell
cd src/PocketLedger.Web
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
dotnet test PocketLedger.slnx
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
- `Infrastructure` implements account and expense persistence with EF Core/Npgsql, owner-filtered expense query projections, Warsaw business dates, password hashing, and JWT signing and validation. Messaging remains planned.
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

Aspire is the development composition root from the first milestone. The AppHost starts the API, the `web` frontend, and the `postgres` server with an `expenses` database. The API references and waits for `expenses`; `web` remains independent. A generated secret signing-key parameter is passed to the API and persisted in AppHost user secrets. Aspire installs frontend dependencies with `npm ci` and checks readiness. The API exports OpenTelemetry; process logs and resource state are visible in the dashboard. A local `tests` resource appears with an explicit Start control and runs the backend suite on demand.

```shell
cd PocketLedger.AppHost
aspire start
```

Open the dashboard URL printed by Aspire. The API, database, and frontend start automatically; their dashboard Start/Stop/Restart actions remain available. Open the `web` resource endpoint for the frontend. To run backend tests, click **Start** on **tests** and view its **Console logs**. Successful completion exits with code 0; use Start or Restart to run it again. The test resource builds the latest source into `.artifacts/tests` and uses disposable PostgreSQL containers, so it can run while the application is up. See [Learning note 010](docs/learning/010-aspire-dashboard-and-tests.md) and [ADR 0009](docs/decisions/0009-dashboard-test-runner.md). The API exposes development health endpoints at `/api/health` and `/api/alive`. Frontend API integration and browser telemetry will be introduced with a real feature.

For API call logs, select **api** in **Console logs** or **Structured logs** and include the **Information** level. The API enables `Microsoft.AspNetCore.Hosting.Diagnostics` at Information for request-start and request-finish events, including method, URL, status, and elapsed time. Other ASP.NET Core categories remain at Warning. Structured entries include a trace ID for correlation; health-probe traces remain excluded, although their request logs are visible. The frontend placeholder does not call the API yet, so refreshing `web` alone does not generate an API call. See [request logging in Learning note 002](docs/learning/002-project-foundation-and-vertical-slices.md#request-logs-and-traces-are-different).

PostgreSQL uses a Docker volume so database contents survive `aspire stop` and subsequent starts. Its container uses the default session lifetime and stops with the AppHost. Aspire manages the local credentials and host port; use the dashboard's `expenses` connection string to connect with a database client. Do not commit credentials. A volume is not a backup.

The API calls `AddPostgresPersistence` and applies versioned account and expense migrations automatically in Development and Testing. Other environments require migrations to be applied separately before startup. Outside Aspire, configure `ConnectionStrings__expenses` and a random `Jwt__SigningKey` of at least 32 bytes through environment variables or secrets; no production key is committed. Optional `Jwt__Issuer` and `Jwt__Audience` default to `PocketLedger` and `PocketLedger.Web`.

The HTTP contract is `POST /api/auth/register` (201), `POST /api/auth/login` (200), each accepting `{ "email": "...", "password": "..." }` and returning `{ "accessToken": "..." }`. `GET /api/auth/me` requires a valid bearer token and returns its account ID. Registration requires 12–128 password characters, defined centrally by `PasswordPolicy` in the authentication slice. Invalid input returns 400, invalid credentials 401, duplicate email 409.

Generate reviewed deployment SQL from the repository root:

```shell
dotnet ef migrations script --idempotent --project src/PocketLedger.Infrastructure --output /tmp/pocketledger-migrations.sql
```

The EF tool is installed separately (`dotnet tool install --global dotnet-ef --version 10.0.11`). Supply database credentials through your deployment secret mechanism when applying SQL. Development migration convenience is not a production rollout strategy. See [Learning note 004](docs/learning/004-postgresql-and-ef-core.md) for persistence concepts and [Learning note 006](docs/learning/006-account-authentication.md) for authentication boundaries and limits.

## Expense HTTP contract

All backend endpoints use the `/api` prefix. Expense routes require a bearer token:

| Method | Route | Success |
| --- | --- | --- |
| POST | `/api/expenses` | 201, expense JSON and `Location` |
| GET | `/api/expenses` | 200, JSON array of the caller's expenses |
| GET | `/api/expenses/{id}` | 200, expense JSON |
| PUT | `/api/expenses/{id}` | 200, replaced expense JSON |
| DELETE | `/api/expenses/{id}` | 204 |

Create and replace accept the same full payload:

```json
{ "amountGrosz": 3500, "purchaseDate": "2026-01-01", "category": "Food", "note": "Lunch", "qualifiesForAllowance": true }
```

Responses add `id`. Amount is a positive signed-64-bit integer in grosz (3500 = 35.00 PLN); dates are calendar dates, no later than today in Europe/Warsaw. Category is required free text with surrounding whitespace trimmed. Note may be null or omitted. The allowance classification must be explicit, including `false`. Ownership comes from the validated JWT subject; JSON owner fields are ignored. Missing/invalid credentials return 401, invalid purchase input 400, and missing or foreign expenses 404. A row deleted during an edit may return 409. Listing is ordered by purchase date descending and then ID and currently returns all owned expenses; pagination and stale-edit detection remain future work. Expense CRUD records data only; it does not calculate an allowance balance.

## Project identity

The solution and project prefix is `PocketLedger`; the frontend package is `pocketledger-web`. Local PostgreSQL uses the explicitly named `pocketledger-postgres-data` Docker volume. During the rename, existing local data was copied and verified, and the original volume was retained as a fallback. The AppHost keeps its existing UserSecretsId, so saved development credentials and the signing key are reused. Tokens issued with the former default issuer/audience require signing in again. The registered checkout folder keeps its existing filesystem location. See [Learning note 009](docs/learning/009-renaming-project-identity.md) and [ADR 0008](docs/decisions/0008-pocketledger-project-identity.md).
