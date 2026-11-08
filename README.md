# PocketLedger

**PocketLedger** is a personal budgeting application built to make a rolling daily allowance easy to understand and use. It is also a guided learning project for domain-driven design, React, ASP.NET Core, messaging, and Kubernetes.

## Current milestone

Feature 3 adds browser login and a protected main page showing the signed-in account’s spending for today in Warsaw, in Polish złoty. Browser authentication now uses Keycloak-hosted forms and a protected server-side cookie session. Phase 6 removes first-party credential endpoints, JWT validation/issuance, and local password-verifier storage. Accounts and expenses persist in PostgreSQL through framework-independent aggregates and EF Core repositories. Each account can access only its own expenses. Rolling allowance calculations remain planned. See [Login and daily spending](docs/learning/012-login-and-daily-spending.md) and [ADR 0011](docs/decisions/0011-daily-spending-projection.md).

See [the expense implementation guide](docs/learning/008-expense-aggregate-and-ownership.md) and [ADR 0007](docs/decisions/0007-expense-aggregate-and-api-prefix.md).

See [authentication contracts and tests](docs/learning/005-authentication-tests-first.md), [the DDD implementation guide](docs/learning/006-account-authentication.md), and [ADR 0005](docs/decisions/0005-account-authentication.md).

## Keycloak local milestone complete

Phase 6 completes backend credential retirement after Phase 5 made Keycloak the browser default, including session restoration, recovery, logout and the protected development reference. Phases 1–4 supplied an explicitly selected development preview with provider-enforced registration policy, tested concurrent identity provisioning, and branded hosted login/registration/confirmation; production enablement remains outside this local milestone. Phase 7 verifies user-free clean setup, full-stack restart persistence, the explicit dashboard runner and integrated browser acceptance. [Learning note 023](docs/learning/023-reproducibility-and-persistence.md) maps all 19 PRD criteria to evidence and records the physical iPhone follow-up limits. See [the plan](docs/plan-keycloak-authentication.md), [research](docs/research-keycloak-authentication.md), [ADR 0014](docs/decisions/0014-keycloak-development-preview.md), and [learning note 016](docs/learning/016-keycloak-preview.md) for the selected architecture and verification status. No account/expense migration or development-data reset is performed. See [ADR 0015](docs/decisions/0015-keycloak-registration-policy.md) and [learning note 017](docs/learning/017-registration-policy-and-concurrent-identity.md) for registration policy, retained-realm upgrades, and concurrency evidence.

## Frontend

`src/PocketLedger.Web` contains a React and TypeScript application built with Vite, with **HeroUI v3** and Tailwind CSS v4 installed. Open `/` to see today’s total. Signed-out visitors go to `/login`; new users can follow the registration link to `/register`. Successful login opens the main page, and registration offers a continuation from its confirmation screen. Valid sessions survive reloads and revisits, bounded by 30 minutes idle and eight hours absolute. Log out completes through the provider confirmation. Passwords go only to Keycloak; provider tokens never reach browser storage.

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

The private root npm package pins Lefthook; the frontend retains its separate package and lockfile. Hook installation downloads a checksum-verified Gitleaks binary into ignored `.tools/`. Node.js 24 LTS, Git, `tar`, and the selected .NET SDK are required. Pre-commit runs without Docker or Aspire. Relevant backend pre-push coverage checks require Docker for disposable API-test PostgreSQL; no Aspire startup is needed.

Changes confined to lowercase `.md` files under `docs/` run lightweight secret scanning and whitespace/conflict-marker checks, while skipping application builds, tests, coverage, and E2E. This includes first pushes of new documentation branches when their known `origin/main` ancestry proves the change is docs-only. Pre-commit checks the staged snapshot; docs-only pre-push checks the exact pushed revisions and their reachable history. Mixed changes, root Markdown, and non-Markdown files under `docs/` retain normal checks; unknown push ancestry falls back to checking the full tree. See [ADR 0021](docs/decisions/0021-docs-markdown-check-exclusion.md).

Otherwise, pre-commit checks staged secrets, whitespace/conflict markers, changed frontend source with Oxlint, and changed C# whitespace formatting. Checks do not fix or stage files; Lefthook preserves unstaged portions of partially staged files. Pre-push selects backend and frontend verification from the pushed refs. Backend push builds use `.artifacts/hooks` and run Docker-free Domain/UseCases tests; frontend checks run lint, TypeScript, a production build, and Vitest. Shared tooling changes select both areas. Build/lint push checks inspect the working tree. The coverage gate separately tests every relevant exact pushed commit against freshly fetched main and rejects any lower line or branch ratio per backend assembly/frontend. It includes full API tests, uses isolated source/build trees, and requires network access for the fresh baseline/dependencies.

[GitHub Actions](.github/workflows/verify.yml) always starts on pushes and pull requests and runs hygiene/secret checks. Its hygiene job determines whether the complete event change is confined to `docs/**/*.md`: docs-only events skip application/test/coverage work and report the existing authentication matrix checks through lightweight success steps. Other changes run the full workflow, including Docker-backed backend tests, frontend checks, and coverage comparisons. Coverage reports are uploaded after actual coverage runs, including failures. Required-check names remain available without skipping the workflow itself; hosted branch settings are unchanged. Maintained-file whitespace checks exclude installed third-party `.agents/skills/` files; secret scanning includes them. Explicit manual hygiene/coverage commands retain their full scope.

Run `npm run hooks:check` to check the current index, `npm test` for hook regression tests, and `npm run check:frontend`, `npm run check:backend`, or `npm run check:hygiene` for the complete area checks. See [Learning note 013](docs/learning/013-git-hooks-and-ci.md) for setup, partial staging, bypasses, and limitations, and [ADR 0012](docs/decisions/0012-git-hooks-and-continuous-integration.md) for the decision.

### Test coverage

Run `npm run coverage` to collect Coverlet/ReportGenerator backend and Vitest V8 frontend coverage. Open `.artifacts/coverage/current/backend/index.html` and `frontend/index.html` for source-level reports. `npm run coverage:check` compares committed HEAD against fresh main; the pre-push hook invokes the same gate for relevant pushed refs. There is no manual baseline percentage file. Docker, .NET, npm, Git, `tar`, and dependency/baseline network access are required for the full gate.

See [learning note 020](docs/learning/020-coverage-and-regression-gates.md) for measured coverage, report paths, comparison rules, and scope limitations, and [ADR 0018](docs/decisions/0018-coverage-regression-gate.md) for the tooling decision. Application .NET and frontend TypeScript are measured; orchestration/provider/theme code retains separate acceptance checks.

### Browser tooling for Codex

The project configures Microsoft's Playwright MCP server in [`.codex/config.toml`](.codex/config.toml). MCP lets Codex inspect pages and interact with the browser while developing PocketLedger. It requires Node.js/npm and downloads `@playwright/mcp@latest` through `npx` on first use. Reopen the project or restart Codex after changing MCP configuration; project settings apply to trusted projects. This development tool does not add automated browser tests to the application.

```shell
dotnet test PocketLedger.slnx
```

HTTP tests require Docker and start a disposable PostgreSQL 17 container. They apply real migrations and cover API restart persistence, concurrent identity provisioning, cookie sessions, and rejection of former bearer tokens. They never use the developer database.

See [docs/domain-model.md](docs/domain-model.md) for the current rules and worked examples.

## Architecture

The backend is a modular monolith with a clean domain core and vertically organized use cases:

```text
Domain <- UseCases <- Infrastructure <- Api <- AppHost
```

- `Domain` owns business language and invariants.
- `UseCases` owns feature handlers and ASP.NET Core controllers inside each vertical slice.
- `Infrastructure` implements EF Core/Npgsql persistence, owner-filtered expense projections, Warsaw dates, the browser OIDC adapter, local identity resolution, antiforgery, and protected PostgreSQL ticket store. Messaging remains planned.
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

Aspire is the development composition root from the first milestone. The AppHost starts `postgres`/`expenses`, `identity-postgres`/`keycloak-db`, Keycloak, the `keycloak-config` registration-policy and URL reconciliation step, the API, and `web`. Identity data has its own `pocketledger-identity-postgres-data` volume. The API waits for both databases, Keycloak readiness, and successful reconciliation. The browser origin stays on port 5173 and the provider on 8080; use the actual dashboard URLs because Aspire may enable provider HTTPS with its trusted development certificate. The API references and waits for `expenses`; `web` waits for the API and receives its HTTP endpoint as `API_BASE_URL`. Only provider/admin secrets are generated and persisted in AppHost user secrets; the API requires no JWT signing key. Aspire installs frontend dependencies with `npm ci` and checks readiness. The API exports OpenTelemetry; process logs and resource state are visible in the dashboard. A local `tests` resource appears with an explicit Start control and runs the backend suite on demand.

```shell
npm --prefix src/PocketLedger.Web ci
npm run build:keycloak-provider
npm run build:keycloak-theme
cd PocketLedger.AppHost
aspire start --non-interactive
```

Open the dashboard URL printed by Aspire. The API, database, and frontend start automatically; their dashboard Start/Stop/Restart actions remain available. Open the `web` resource endpoint for the frontend. To run backend tests, click **Start** on **tests** and view its **Console logs**. Successful completion exits with code 0; use Start or Restart to run it again. The test resource builds the latest source into `.artifacts/tests` and uses disposable PostgreSQL containers, so it can run while the application is up. See [Learning note 010](docs/learning/010-aspire-dashboard-and-tests.md) and [ADR 0009](docs/decisions/0009-dashboard-test-runner.md). The API exposes development health endpoints at `/api/health` and `/api/alive`. Browser registration enters `/api/auth/preview/start?mode=register&returnUrl=%2F` through the Vite proxy; credential submission goes to Keycloak. Browser telemetry remains planned.

When the preview is enabled, HTTP request-start/finish logging is suppressed because callback queries contain authentication material; query redaction stays enabled for telemetry. Do not enable protocol/body/cookie logging. The following request-logging description applies when the preview is disabled.

For API call logs, select **api** in **Console logs** or **Structured logs** and include the **Information** level. The API enables `Microsoft.AspNetCore.Hosting.Diagnostics` at Information for request-start and request-finish events, including method, URL, status, and elapsed time. Other ASP.NET Core categories remain at Warning. Structured entries include a trace ID for correlation; health-probe traces remain excluded, although their request logs are visible. Submitting registration generates an API call; refreshing `web` alone does not. See [request logging in Learning note 002](docs/learning/002-project-foundation-and-vertical-slices.md#request-logs-and-traces-are-different).

PostgreSQL uses a Docker volume so database contents survive `aspire stop` and subsequent starts. Its container uses the default session lifetime and stops with the AppHost. Aspire manages the local credentials and host port; use the dashboard's `expenses` connection string to connect with a database client. Do not commit credentials. A volume is not a backup.

The API calls `AddPostgresPersistence` and applies versioned account and expense migrations automatically in Development and Testing. Other environments require migrations to be applied separately before startup. Outside Aspire, configure `ConnectionStrings__expenses` and the enabled local Keycloak integration (`Keycloak__Enabled`, `Keycloak__Authority`, `Keycloak__BrowserOrigin`, `Keycloak__ClientSecret`, and optional `Keycloak__ClientId`, default `pocketledger-web`). Persist the Data Protection key ring with `Keycloak__KeyRingPath` when API process identity/storage changes. Keycloak enablement remains restricted to Development/Testing; this milestone does not configure a production deployment. No `Jwt__SigningKey`, issuer, or audience is required or consumed. Authentication uses the protected server-side cookie; former `POST /api/auth/register` and `/api/auth/login` return 404. All bearer tokens, including correctly signed former PocketLedger tokens, fail to authenticate.

Before upgrading an existing database, follow the [cutover and backup procedure](docs/learning/022-credential-retirement.md#cutover-and-fresh-account-procedure). The new migration removes password verifiers irreversibly, while retaining account IDs, expenses, external identities, and browser tickets. Legacy accounts without an external identity remain inaccessible historical rows. Registering the same email creates an independent owner; no data is linked or transferred. No reset is required or performed.

For repeatable acceptance with disposable services:

```shell
npm --prefix tests/PocketLedger.E2E ci
npx --prefix tests/PocketLedger.E2E playwright install chromium
npm run build:keycloak-provider
npm run build:keycloak-theme
npm --prefix tests/PocketLedger.E2E test
E2E_REALM_BASELINE=phase1 npm --prefix tests/PocketLedger.E2E test
```

See the [E2E harness guide](tests/PocketLedger.E2E/README.md), [ADR 0014](docs/decisions/0014-keycloak-development-preview.md), and [learning note 016](docs/learning/016-keycloak-preview.md) for evidence and remaining milestone boundaries. The browser suite runs separately from the dashboard’s backend `tests` resource and has its own CI job.

## Expense HTTP contract

All backend endpoints use the `/api` prefix. Expense requests require the protected cookie session. Mutations also need a request token from `/api/auth/preview/antiforgery` in `X-CSRF-TOKEN`. The historical `X-PocketLedger-Auth` header is ignored; it cannot select another authentication mode. Routes are:

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

Responses add `id`. Amount is a positive signed-64-bit integer in grosz (3500 = 35.00 PLN); dates are calendar dates, no later than today in Europe/Warsaw. Category is required free text with surrounding whitespace trimmed. Note may be null or omitted. The allowance classification must be explicit, including `false`. Ownership comes from the validated cookie session’s resolved local account identity; JSON owner fields are ignored. Missing/invalid credentials return 401, invalid purchase input 400, and missing or foreign expenses 404. A row deleted during an edit may return 409. Listing is ordered by purchase date descending and then ID and currently returns all owned expenses; pagination and stale-edit detection remain future work. Expense CRUD records data only; it does not calculate an allowance balance.

## Project identity

The solution and project prefix is `PocketLedger`; the frontend package is `pocketledger-web`. Local PostgreSQL uses the explicitly named `pocketledger-postgres-data` Docker volume. During the rename, existing local data was copied and verified, and the original volume was retained as a fallback. The AppHost keeps its existing UserSecretsId, so saved provider/database secrets remain available. The obsolete signing-key entry, if present, is retained but unused; former tokens are rejected. The registered checkout folder keeps its existing filesystem location. See [Learning note 009](docs/learning/009-renaming-project-identity.md) and [ADR 0008](docs/decisions/0008-pocketledger-project-identity.md).

See [Learning note 011](docs/learning/011-registration-page.md) and [ADR 0010](docs/decisions/0010-registration-frontend-api-connection.md) for registration behavior, proxy setup, and verification.

## Default Keycloak browser journey

Open `/login` or `/register` to enter the branded hosted form; `/` first checks the cookie session and starts login when none exists. Registration confirmation retains the provider-created email and “View today’s spending” continuation. The frontend still sends the historical `X-PocketLedger-Auth: preview` header, which is now ignored. The cookie scheme is the sole default. Endpoint/scheme/cookie names remain compatible to preserve existing sessions and callbacks; there is no mode selector. `/preview` is a compatibility destination for retained provider journeys.

`App` owns session verification before spending or the development-only design reference mounts, and on visibility/history restoration and each minute. Failed checks hide protected content and offer retry; ended sessions offer login. Browser protocol failures navigate to `/auth/recovery` carrying only an allowlisted code and optional exact reference destination. API clients retain JSON/status responses. Logout clears rendered spending before the antiforgery-protected POST, revokes local tickets and completes Keycloak confirmation; the protected logout-token endpoint also works after local expiry. Provider outages can prevent remote completion, so incomplete logout never claims both sessions ended.

The Keycloak backend still permits enabled configuration only in Development/Testing. This browser default is a local milestone, not production enablement. Phase 6 retires legacy endpoints/verifiers/signing-key configuration; Phase 7 owns final clean setup and persistence acceptance. Account and expense rows, volumes and unrelated secrets are retained. Existing legacy accounts do not inherit a new external account’s ownership. See [ADR 0020](docs/decisions/0020-keycloak-credential-retirement.md) and [learning note 022](docs/learning/022-credential-retirement.md) for the completed backend cutover.
