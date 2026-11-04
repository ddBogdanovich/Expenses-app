# PocketLedger

**PocketLedger** is a personal budgeting application built to make a rolling daily allowance easy to understand and use. It is also a guided learning project for domain-driven design, React, ASP.NET Core, messaging, and Kubernetes.

## Current milestone

Feature 3 adds browser login and a protected main page showing the signed-in account’s spending for today in Warsaw, in Polish złoty. Authentication uses signed, 30-minute JWT access tokens. Accounts and expenses persist in PostgreSQL through framework-independent aggregates and EF Core repositories. Each account can access only its own expenses. Rolling allowance calculations remain planned. See [Login and daily spending](docs/learning/012-login-and-daily-spending.md) and [ADR 0011](docs/decisions/0011-daily-spending-projection.md).

See [the expense implementation guide](docs/learning/008-expense-aggregate-and-ownership.md) and [ADR 0007](docs/decisions/0007-expense-aggregate-and-api-prefix.md).

See [authentication contracts and tests](docs/learning/005-authentication-tests-first.md), [the DDD implementation guide](docs/learning/006-account-authentication.md), and [ADR 0005](docs/decisions/0005-account-authentication.md).

## Keycloak milestone in progress

The default password/JWT flow remains current. Phase 1 is introducing an explicitly selected development preview; it is not a production authentication change. See [the plan](docs/plan-keycloak-authentication.md), [research](docs/research-keycloak-authentication.md), [ADR 0014](docs/decisions/0014-keycloak-development-preview.md), and [learning note 016](docs/learning/016-keycloak-preview.md) for the selected architecture and verification status. No account/expense migration or development-data reset is performed.

## Frontend

`src/PocketLedger.Web` contains a React and TypeScript application built with Vite, with **HeroUI v3** and Tailwind CSS v4 installed. Open `/` to see today’s total. Signed-out visitors go to `/login`; new users can follow the registration link to `/register`. Successful login opens the main page, and registration offers a continuation from its confirmation screen. Tokens stay in memory. Logging out or reloading requires a fresh login.

The account and daily spending screens adapt to phones, including iPhone Pro Max portrait and landscape widths. Phone layouts prioritize the form, use large tap targets and safe-area spacing, and allow scrolling above the software keyboard. See [Mobile layout and accessibility](docs/learning/014-mobile-layout-and-accessibility.md) for implementation choices and browser verification limits.

The frontend follows the [PocketLedger design guide](docs/design/README.md), with shared theme tokens, page/notice patterns, and a feature-owned spending summary. Sign in and select **Design reference** in the development header for interactive local examples. Direct `/design-system` visits require login and API session verification; this reference page is excluded from production builds. See [Learning note 015](docs/learning/015-frontend-design-system.md) and [ADR 0013](docs/decisions/0013-code-backed-frontend-design-system.md).

To install dependencies and verify the frontend:

```shell
cd src/PocketLedger.Web
npm ci
npm run build
npm run lint
npm test
```

Read [Learning note 003](docs/learning/003-react-frontend-foundation.md) for the purpose of each tool and [ADR 0003](docs/decisions/0003-react-vite-frontend.md) for the technology choices.

## Prerequisites

- .NET SDK 10
- Aspire CLI 13.5 or later
- Node.js 24 LTS and npm (the installed Vite version requires Node.js 20.19+ or 22.12+)
- Docker Desktop or another running Aspire-compatible container runtime for PostgreSQL

## Run the tests

### Git hooks and CI

Install repository tooling and activate the local checks from the repository root:

```shell
npm ci
npm run hooks:install
npm --prefix src/PocketLedger.Web ci
dotnet restore PocketLedger.slnx
```

The private root npm package pins Lefthook; the frontend retains its separate package and lockfile. Hook installation downloads a checksum-verified Gitleaks binary into ignored `.tools/`. Node.js 24 LTS, Git, `tar`, and the selected .NET SDK are required. Hooks run without Docker or Aspire; the complete API suite still requires Docker.

Pre-commit checks staged secrets, whitespace/conflict markers, changed frontend source with Oxlint, and changed C# whitespace formatting. Checks do not fix or stage files; Lefthook preserves unstaged portions of partially staged files. Pre-push selects backend and frontend verification from the pushed refs. Backend push builds use `.artifacts/hooks` and run Docker-free Domain/UseCases tests; frontend checks run lint, TypeScript, a production build, and Vitest. Shared tooling changes select both areas; documentation-only changes skip builds. Local push checks inspect the working tree; CI validates committed revisions.

[GitHub Actions](.github/workflows/verify.yml) runs hygiene/secret checks, full backend verification including PostgreSQL API tests, and full frontend verification on pushes and pull requests. Branch protection must be enabled separately in GitHub if these checks should block merges. Maintained-file whitespace checks exclude installed third-party `.agents/skills/` files; secret scanning includes them.

Run `npm run hooks:check` to check the current index, `npm test` for hook regression tests, and `npm run check:frontend`, `npm run check:backend`, or `npm run check:hygiene` for the complete area checks. See [Learning note 013](docs/learning/013-git-hooks-and-ci.md) for setup, partial staging, bypasses, and limitations, and [ADR 0012](docs/decisions/0012-git-hooks-and-continuous-integration.md) for the decision.

### Browser tooling for Codex

The project configures Microsoft's Playwright MCP server in [`.codex/config.toml`](.codex/config.toml). MCP lets Codex inspect pages and interact with the browser while developing PocketLedger. It requires Node.js/npm and downloads `@playwright/mcp@latest` through `npx` on first use. Reopen the project or restart Codex after changing MCP configuration; project settings apply to trusted projects. This development tool does not add automated browser tests to the application.

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
- `Web` is a browser frontend; Aspire starts its Vite development server and supplies the API endpoint for its `/api` development proxy.

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

Aspire is the development composition root from the first milestone. The AppHost starts the API, the `web` frontend, and the `postgres` server with an `expenses` database. The API references and waits for `expenses`; `web` waits for the API and receives its HTTP endpoint as `API_BASE_URL`. A generated secret signing-key parameter is passed to the API and persisted in AppHost user secrets. Aspire installs frontend dependencies with `npm ci` and checks readiness. The API exports OpenTelemetry; process logs and resource state are visible in the dashboard. A local `tests` resource appears with an explicit Start control and runs the backend suite on demand.

```shell
cd PocketLedger.AppHost
aspire start
```

Open the dashboard URL printed by Aspire. The API, database, and frontend start automatically; their dashboard Start/Stop/Restart actions remain available. Open the `web` resource endpoint for the frontend. To run backend tests, click **Start** on **tests** and view its **Console logs**. Successful completion exits with code 0; use Start or Restart to run it again. The test resource builds the latest source into `.artifacts/tests` and uses disposable PostgreSQL containers, so it can run while the application is up. See [Learning note 010](docs/learning/010-aspire-dashboard-and-tests.md) and [ADR 0009](docs/decisions/0009-dashboard-test-runner.md). The API exposes development health endpoints at `/api/health` and `/api/alive`. Registration calls `/api/auth/register` through the Vite proxy. Browser telemetry remains planned.

For API call logs, select **api** in **Console logs** or **Structured logs** and include the **Information** level. The API enables `Microsoft.AspNetCore.Hosting.Diagnostics` at Information for request-start and request-finish events, including method, URL, status, and elapsed time. Other ASP.NET Core categories remain at Warning. Structured entries include a trace ID for correlation; health-probe traces remain excluded, although their request logs are visible. Submitting registration generates an API call; refreshing `web` alone does not. See [request logging in Learning note 002](docs/learning/002-project-foundation-and-vertical-slices.md#request-logs-and-traces-are-different).

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
| GET | `/api/expenses/today` | 200, Warsaw purchase date and total for the caller, e.g. `{"purchaseDate":"2026-11-02","totalGrosz":"4237"}` |
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

See [Learning note 011](docs/learning/011-registration-page.md) and [ADR 0010](docs/decisions/0010-registration-frontend-api-connection.md) for registration behavior, proxy setup, and verification.
