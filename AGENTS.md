# Agent instructions for PocketLedger

## Purpose and working style

This is both a personal budgeting application and a guided engineering study project. Optimize for a useful, intuitive daily experience, maintainability by one person, and code the owner can explain to a prospective employer.

The owner wants to study DDD, React, .NET, Aspire, messaging, and Kubernetes. Explain new concepts when introducing them: what they mean, which problem they solve here, their alternatives, and their costs. Technical sophistication is welcome when it supports a concrete learning objective; keep the product UI simple.

For each substantial implementation step, add or update a focused note under `docs/learning/`. Include examples from this application and questions or an exercise where useful. Record consequential architecture decisions under `docs/decisions/` with the next sequential ADR number. Keep the README and domain documentation consistent with the implementation. Small edits do not need a new learning document.

## Read before changing code

- `README.md`: current milestone, setup, and frontend choice.
- `docs/domain-model.md`: product rules and ubiquitous language.
- `docs/decisions/`: accepted architecture decisions.
- Relevant existing code and tests; do not assume proposed features already exist.

Human instructions in the current conversation take precedence over these repository conventions. Preserve unrelated local changes and do not commit, push, or publish unless requested.

## Product rules

- PLN only; represent money as integer grosz through the `Money` value object.
- Use `Europe/Warsaw` for business calendar dates.
- The initial daily allowance is 50.00 PLN. Unspent allowance carries forward, and overspending reduces future available allowance.
- Calculate allowance from inclusive elapsed dates and qualifying expenses rather than scheduling midnight transfers.
- Carryover crosses month and year boundaries. Backdated changes affect later balances; rate changes preserve historical rates.
- `Money` can be signed. Expense positivity is an expense invariant.
- Follow `docs/domain-model.md` for the full rules; update it when an authorized product decision changes them.

## Architecture

Start with a modular monolith and a framework-independent domain core. Organize application behavior into vertical slices.

- `src/PocketLedger.Domain`: domain behavior, aggregates, entities, value objects, and aggregate-specific repository contracts. No ASP.NET Core, EF Core, messaging, or UI dependencies.
- `src/PocketLedger.UseCases`: feature folders containing their controller, request, handler, validation, response, and mapping as needed. Shared application contracts live in `Common`. Query-service contracts belong here.
- `src/PocketLedger.Infrastructure`: repository and query-service implementations, persistence, messaging, and external integrations.
- `src/PocketLedger.Api`: host configuration and dependency composition.
- `src/PocketLedger.ServiceDefaults`: shared Aspire health, telemetry, discovery, and resilience configuration.
- `PocketLedger.AppHost`: local resource orchestration, including an on-demand `tests` executable visible in the dashboard. It is registered only in run mode with WithExplicitStart and executes dotnet test using `.artifacts/tests` for isolated build outputs. API integration tests retain their own disposable databases.
- `src/PocketLedger.Web`: React and TypeScript frontend, built with Vite and styled with HeroUI v3 and Tailwind CSS v4.
- `tests/`: tests organized by the project and behavior they validate.

Use aggregate-specific repositories for writes and focused query services for read projections. Avoid generic `IRepository<T>`. Introduce contracts alongside the feature or aggregate that needs them.

Use ASP.NET Core `[ApiController]` controllers inside vertical-slice feature folders and `IUseCaseHandler<TRequest, TResponse>` with controlled handler scanning. Controllers invoke their concrete handlers through constructor injection. Register the UseCases assembly as an MVC application part and map controllers in the API host. Keep controllers thin: routing, binding, authorization attributes, and explicit HTTP response mapping only. Do not reintroduce minimal API business endpoints or `IEndpoint`; shared health/telemetry endpoints may retain framework mapping helpers.

Use explicit mapping functions. Do not introduce MediatR or AutoMapper without a concrete need and an explained architecture decision.

Use `Result` for expected business outcomes such as validation, missing records, and conflicts. Keep exceptions for programming errors, broken internal invariants, and infrastructure failures. Preserve checked monetary arithmetic to prevent silent overflow.

The Keycloak Phase 1 preview, Phase 2 registration/identity policy, Phase 3 hosted experience, and Phase 4 backend session hardening are implemented; their designs are recorded in ADRs 0014–0017. Phase 5 makes Keycloak the default browser flow; Phase 6 removes legacy endpoints, JWT services, password verifiers, and signing-key configuration (ADR 0020). Use exact issuer/subject mapping to local IDs, server-side tickets, antiforgery on cookie mutations, and migrations that preserve owner/expense rows. Historical preview scheme/cookie/callback names remain compatible; cookies are now the sole default and selection headers are ignored. Track delivered behavior and limitations in learning notes 016–022.

## Documentation after architecture changes

Treat documentation updates as part of completing an architecture change. In the same task, review and update all affected descriptions of project structure, module responsibilities, dependency direction, technology choices, resource orchestration, and deployment topology.

- Update `README.md`, including architecture diagrams, setup instructions, and current milestone where affected.
- Update this `AGENTS.md` so its architecture, technology, and verification instructions match the implemented project.
- Update affected learning notes and exercises so explanations, examples, paths, and commands remain accurate. Clearly distinguish planned capabilities from implemented ones.
- Update `docs/domain-model.md` when domain boundaries, terminology, or business rules change.
- Add an ADR for consequential decisions. Preserve the historical rationale of existing ADRs; mark replaced decisions as superseded and link to the replacement rather than rewriting history.
- Review documentation links, diagrams, and commands against the final implementation before reporting the architecture change complete.

## Technology and conventions

- Backend: .NET 10 / ASP.NET Core; honor SDK selection in `global.json`.
- Frontend: React with TypeScript, Vite, **HeroUI v3**, and Tailwind CSS v4. Use npm and commit `package-lock.json`; use `npm ci` for reproducible installs. Use the repository's HeroUI and React skills for frontend work. The frontend enters Keycloak-hosted registration/login, restores a protected cookie session before daily spending, and uses HeroUI with a Vite `/api` proxy. Aspire supplies `API_BASE_URL` from the API HTTP endpoint and waits for API readiness. Rolling allowance screens remain planned.
- Frontend design: read `src/PocketLedger.Web/AGENTS.md` and `docs/design/README.md` before UI work. `src/styles/tokens.css` owns theme values; `PageShell` and `Notice` provide shared presentation, while `SpendingSummary` remains in its daily-spending feature. Use HeroUI v3 controls directly and preserve the explicit light theme/system font stack. The lazy-loaded `/design-system` reference is development-only and requires a signed-in session verified through `/api/auth/me`; its sample interactions use local data without API calls. Signed-out visits go to login. Keep the reference out of production output. Update guide, code, and examples together; generic skill suggestions must fit the accepted product rules. See ADR 0013 and learning note 015.
- Aspire and OpenTelemetry are required from day one. Use the applicable repository Aspire skills when changing AppHost wiring or managing its lifecycle.
- Preview authentication: native hosted login under `infra/keycloak/themes/pocketledger` consumes the Web production CSS/shared SVG packaged by `npm run build:keycloak-theme`. `PreviewOidc` uses confidential code + PKCE with no saved provider tokens; `PreviewCookie` uses protected PostgreSQL tickets, a bounded persistent cookie, 30-minute idle and 8-hour absolute expiry. The cookie is the sole default authentication scheme. Historical `X-PocketLedger-Auth` headers are ignored and bearer tokens do not authenticate. Resolve exact issuer/opaque subject to a local GUID and use antiforgery on cookie-authenticated mutations. HTTP local exceptions are Development/Testing only. Provider registration accepts email/password only (12–128 characters), with trimmed case-insensitive email and a narrow Keycloak provider action; build it with `npm run build:keycloak-provider` before startup. Hosted login/registration/confirmation use the shared theme; the default browser design reference verifies the cookie session in `App`. Authentication and expense responses use no-store before authentication/authorization. Preview start accepts only exact `/preview`, `/`, and `/design-system` return destinations. Callback failures use bounded codes documented in ADRs 0017/0019: JSON for API clients and an allowlisted recovery redirect for HTML documents; API 401 responses never redirect. Classify provider HTTP 5xx before protocol parsing, suppress raw OIDC logging, and preserve telemetry query redaction. Phase 5 supplies default browser session/recovery UI; Phase 6 completes backend credential retirement. The transaction-only confirmation required action must match a server-created-user note before rendering the stored email or accepting continuation; never replace it with a browser flag. It confirms account creation, not email ownership. Configuration registers only the owned action, never makes it a realm default, and supplies an approved client base URL for error recovery. Theme packaging checks password guidance against realm policy.
- Accounts: `Domain/Accounts` contains `UserAccount`, `EmailAddress`, `ExternalIdentity`, and `IUserAccountRepository`. Provisioning lives in `UseCases/Authentication/ResolveExternalAccount`; Infrastructure implements EF persistence and the OIDC/cookie boundary. New accounts require exact issuer/opaque subject, with independent uniqueness; email is a non-unique snapshot. Never link accounts by email. Retained legacy accounts have no external identity and cannot authenticate; keep their IDs and owned expenses. The current model/schema has no password verifier; historical migrations remain. Keycloak alone owns credential registration/verification. Former credential endpoints return 404 and all first-party JWTs are rejected. See ADR 0020 and learning note 022 for the irreversible verifier-removal migration and backup/fresh-account procedure.
- Expenses: `Domain/Expenses/Expense` is a small aggregate root with immutable ownership and positive `Money`, a non-future purchase date, free-text category, optional note, and explicit allowance classification. `UseCases/Expenses` contains Create, GetById, List, Update, Delete, and Today slices. `IExpenseRepository` owns writes; `IExpenseQueries` owns read projections. Every lookup includes the authenticated owner ID. Foreign IDs return NotFound. `ICurrentAccount` reads validated identity; `IBusinessCalendar` uses TimeProvider and Europe/Warsaw. The Today projection sums all owned expenses for the Warsaw business date and returns exact integer digits in `totalGrosz`. No allowance calculation is implemented yet.
- Routes: all backend HTTP endpoints use `/api`, including authentication (`/api/auth/...`), expenses (`/api/expenses`), and development health endpoints (`/api/health`, `/api/alive`). Keep Aspire probes and HTTP examples aligned.
- Persistence: PostgreSQL (`postgres`, logical database `expenses`) retains the explicitly named `pocketledger-postgres-data` volume and session container lifetime. The API now references and waits for `expenses`, calls `AddPostgresPersistence`, and maps accounts and expenses through EF Core 10/Npgsql. Versioned migrations are applied at API startup only in Development and Testing; other environments apply reviewed migrations separately. AppHost supplies persisted provider/admin secrets; no JWT signing-key parameter or injection remains. Existing unused signing-key entries are preserved. Preserve the AppHost UserSecretsId across project renames so saved local credentials remain available. Never commit real credentials or keys.
- Identity orchestration: Keycloak has separate `identity-postgres`/`keycloak-db` persistence and the `pocketledger-identity-postgres-data` volume. Pin the provider image and compatible preview hosting package; preserve all application volumes/UserSecretsId. A user-free import uses persisted runtime secrets, and `keycloak-config` reconciles the versioned registration flow, owned user profile, realm/client policy, the owned confirmation required action, and browser callback/logout/recovery URLs through authenticated administration without recreating users or credentials. Built-in flows and unrelated settings are retained; the provider JAR is mounted read-only. API waits for successful configuration. Public browser URLs must not be container-rebased service addresses.
- API integration tests use Testcontainers PostgreSQL with real migrations and disposable data. Docker is required. Preserve coverage for restart persistence, provider registration/identity races, and rejection of former tokens; do not substitute an in-memory repository as proof of database behavior.
- Messaging and Kubernetes are planned learning areas. Add them with a feature or learning milestone that defines their purpose.
- Respect `.editorconfig`: UTF-8, LF, four-space C# indentation, `I` interface prefix, and `Async` suffix for asynchronous methods.
- Do not use unexplained numeric literals in production code. Express business limits, security thresholds, conversion factors, timeouts, and storage limits as meaningfully named constants or typed policies owned by the relevant feature/layer. Reuse the same definition in validation, error text, and persistence when they represent the same rule. Use validated configuration for values that genuinely vary by environment; avoid a global catch-all constants class. Obvious structural values (for example zero), package versions, generated migrations/snapshots, and explicit test inputs/expected values may remain literals. This is a repository-wide implementation and code-review rule.
- Keep package versions in `Directory.Packages.props`; package references in project files must omit versions. SDK versions remain SDK declarations.
- Preserve nullable analysis, warnings as errors, `AnalysisMode=All`, and deterministic compilation. Use the built-in .NET analyzers and Sonar; explain any narrowly scoped suppression.
- Tests currently use xUnit v2 (`xunit` 2.9.3). The v3 Visual Studio runner does not imply a v3 test framework. A v3 migration was recommended but has not been implemented or authorized as a task.

## Verification

Repository-wide Git checks use Lefthook 2.2.2 from the private root npm tooling package. Run `npm ci` and `npm run hooks:install` per clone; the latter installs the pinned, checksum-verified Gitleaks binary in ignored `.tools/` and activates pre-commit/pre-push. Frontend dependencies remain in their separate npm package. Keep both lockfiles reproducible. Node and .NET must be on Git clients' PATH.

Pre-commit checks staged secrets, maintained-file whitespace/conflict markers, frontend source lint, and C# whitespace formatting without fixing or staging source. Lefthook preserves unstaged portions of partially staged files. Pre-push reads Git's input refs and conditionally checks relevant areas in the current working tree; working-tree backend builds use `.artifacts/hooks` and run Domain/UseCases tests. Relevant pre-push changes additionally collect coverage for exact pushed commits and fresh main in temporary archives, including Docker-backed API tests; source builds stay isolated. Shared tooling changes select both areas. `npm test` at the root runs hook/coverage regression tests; `npm run hooks:check` checks the current index. Installed third-party `.agents/skills/` files are excluded only from whitespace checks, not secret scanning.

`.github/workflows/verify.yml` runs complete committed-revision checks on pushes and pull requests, including Docker-backed API tests. `npm run check:backend`, `npm run check:frontend`, and `npm run check:hygiene` expose the CI checks locally. Hygiene checks inspect the committed tree and reachable Git history. The `coverage` CI job uses Coverlet/ReportGenerator and Vitest V8, rejects exact line/branch degradation per measured module, and uploads reports even on failure. `npm run coverage` collects working-tree reports; `npm run coverage:check` compares committed HEAD to fresh main. Runtime assembly/collector inventories must be complete; exclude only generated EF migrations, frontend test/spec files, and type declarations. Coverage percentages cover application .NET/TypeScript, not AppHost/provider/theme/tooling execution. Backend pre-push coverage now requires Docker and network access; pre-commit remains Docker-free. See ADR 0018 and learning note 020. Local hooks can be bypassed; hosted branch protection is configured separately. See `docs/learning/013-git-hooks-and-ci.md` and ADR 0012. Tooling changes need the root regression suite and relevant hook/CI command validation; do not create a real commit or push solely to test hooks.

Run commands from the repository root unless stated otherwise:

```sh
dotnet restore PocketLedger.slnx
dotnet build PocketLedger.slnx --no-restore
dotnet test PocketLedger.slnx --no-build
dotnet format PocketLedger.slnx --no-restore --verify-no-changes
```

Restore when dependencies change. For code changes, build and run relevant behavior tests; check formatting when source changes. Documentation-only edits need a content and link review, not a full build. Tests should verify business rules, boundary cases, and observable behavior rather than mirror implementation details.

The retained `tests/PocketLedger.E2E` suite owns disposable Keycloak and two PostgreSQL services plus network-reachable API/Vite. Run `npm --prefix tests/PocketLedger.E2E ci`, install pinned Chromium, build the provider and theme (`npm run build:keycloak-provider`, `npm run build:keycloak-theme`), then `npm --prefix tests/PocketLedger.E2E test`. Repeat with `E2E_REALM_BASELINE=phase1` for retained-realm upgrade acceptance; CI runs both modes. It proves registration boundaries/duplicates/races, code-flow login, isolated ownership, persistent API restart, CSRF rejection, cookie tampering/replay, and both-session logout; never use developer accounts or password grants as a browser-login shortcut. Traces/inspection credentials are sensitive ignored artifacts and must not be published.

For frontend changes, run `npm run build` and `npm run lint` from `src/PocketLedger.Web`. The build includes strict TypeScript checks. Use `npm ci` after dependency changes or in a fresh checkout. Run `npm test` for frontend behavior tests (Vitest, Testing Library, jsdom). Frontend tests cover session restoration, fail-closed access, recovery, logout/history races and exact totals. Hosted registration validation, duplicates, pending submissions and password visibility remain real-browser E2E coverage.

Every frontend UI change must also pass visual validation in a real browser using **Playwright MCP** and a review using the project-local [ui-ux-pro-max skill](.agents/skills/ui-ux-pro-max/SKILL.md). Use Playwright MCP to inspect the final rendered UI at desktop and mobile widths, capture and visually inspect screenshots, exercise affected interactions and relevant loading, error, and success states, and check readability, contrast, keyboard access, focus behavior, and responsive layout. Fix all identified UI/UX issues and repeat the affected checks through Playwright MCP after each fix. A task involving UI changes is complete only when the final Playwright MCP validation and skill review find no unresolved issues and the required frontend checks pass. If Playwright MCP or the skill review is unavailable, report the blocker and keep the task incomplete; passing tests, a build, or CLI-only browser checks does not satisfy this rule.

Prioritize phone use, including iPhone Pro Max portrait and landscape. Preserve form-first account layouts, safe-area insets, scrollable keyboard access, generous touch targets, and scalable text. Include large-phone, small-phone, landscape, and 200% text checks when changing these layouts. See `docs/learning/014-mobile-layout-and-accessibility.md` for the browser test matrix and physical iPhone verification limits.

The dashboard `tests` resource restores/builds and runs the backend suite from the repository root. Start it explicitly from the dashboard and inspect its exit code and console logs; it must remain inactive at normal AppHost startup. Its `.artifacts/tests` output tree is ignored by Git. Do not pass the development connection string or signing key to this runner.

For AppHost or service-wiring changes, validate through Aspire from `PocketLedger.AppHost`: start the AppHost, wait for affected resources to become healthy, and inspect relevant logs or telemetry. Use Aspire lifecycle commands rather than `dotnet run`. Stop processes started solely for verification when finished; preserve sessions the user wants running. Report what passed and any checks that could not run.

Sandbox restrictions may block local build-host pipes or Aspire's user-level state directories. Use the environment's normal escalation mechanism when needed rather than changing architecture or weakening checks to work around the sandbox.

Phase 5 logout bridge: `/api/auth/preview/logout-token` can issue a request-bound antiforgery token to an expired/anonymous browser. Named cookie authentication still runs when possible; the logout endpoint permits local expiry but validates antiforgery even without an authenticated principal. This permits ending provider SSO after a local ticket expires. The original authenticated antiforgery endpoint and expense mutation policy remain unchanged. Browser registration mode switches only the trusted Keycloak authorization entry endpoint; protected state, correlation and PKCE remain framework-owned. See ADR 0019.
