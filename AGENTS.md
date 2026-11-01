# Agent instructions for Poland Expenses

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

- `src/PolandExpenses.Domain`: domain behavior, aggregates, entities, value objects, and aggregate-specific repository contracts. No ASP.NET Core, EF Core, messaging, or UI dependencies.
- `src/PolandExpenses.UseCases`: feature folders containing their controller, request, handler, validation, response, and mapping as needed. Shared application contracts live in `Common`. Query-service contracts belong here.
- `src/PolandExpenses.Infrastructure`: repository and query-service implementations, persistence, messaging, and external integrations.
- `src/PolandExpenses.Api`: host configuration and dependency composition.
- `src/PolandExpenses.ServiceDefaults`: shared Aspire health, telemetry, discovery, and resilience configuration.
- `PolandExpenses.AppHost`: local resource orchestration.
- `src/PolandExpenses.Web`: React and TypeScript frontend, built with Vite and styled with HeroUI v3 and Tailwind CSS v4.
- `tests/`: tests organized by the project and behavior they validate.

Use aggregate-specific repositories for writes and focused query services for read projections. Avoid generic `IRepository<T>`. Introduce contracts alongside the feature or aggregate that needs them.

Use ASP.NET Core `[ApiController]` controllers inside vertical-slice feature folders and `IUseCaseHandler<TRequest, TResponse>` with controlled handler scanning. Controllers invoke their concrete handlers through constructor injection. Register the UseCases assembly as an MVC application part and map controllers in the API host. Keep controllers thin: routing, binding, authorization attributes, and explicit HTTP response mapping only. Do not reintroduce minimal API business endpoints or `IEndpoint`; shared health/telemetry endpoints may retain framework mapping helpers.

Use explicit mapping functions. Do not introduce MediatR or AutoMapper without a concrete need and an explained architecture decision.

Use `Result` for expected business outcomes such as validation, missing records, and conflicts. Keep exceptions for programming errors, broken internal invariants, and infrastructure failures. Preserve checked monetary arithmetic to prevent silent overflow.

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
- Frontend: React with TypeScript, Vite, **HeroUI v3**, and Tailwind CSS v4. Use npm and commit `package-lock.json`; use `npm ci` for reproducible installs. Use the repository's HeroUI and React skills for frontend work. The current scaffold contains only a placeholder page.
- Aspire and OpenTelemetry are required from day one. Use the applicable repository Aspire skills when changing AppHost wiring or managing its lifecycle.
- Accounts: `Domain/Accounts` contains `UserAccount`, `EmailAddress`, and `IUserAccountRepository`. Authentication handlers and credential/token ports live in `UseCases/Authentication`; Infrastructure implements EF persistence, Identity password hashing, and JWT issuance/validation. Emails are trimmed and case-insensitive identities. Registration requires 12–128 password characters; login never creates accounts. Expected authentication failures use `Result` including Unauthorized.
- Expenses: `Domain/Expenses/Expense` is a small aggregate root with immutable ownership and positive `Money`, a non-future purchase date, free-text category, optional note, and explicit allowance classification. `UseCases/Expenses` contains Create, GetById, List, Update, and Delete slices. `IExpenseRepository` owns writes; `IExpenseQueries` owns read projections. Every lookup includes the authenticated owner ID. Foreign IDs return NotFound. `ICurrentAccount` reads validated identity; `IBusinessCalendar` uses TimeProvider and Europe/Warsaw. No allowance calculation is implemented yet.
- Routes: all backend HTTP endpoints use `/api`, including authentication (`/api/auth/...`), expenses (`/api/expenses`), and development health endpoints (`/api/health`, `/api/alive`). Keep Aspire probes and HTTP examples aligned.
- Persistence: PostgreSQL (`postgres`, logical database `expenses`) retains a data volume and session container lifetime. The API now references and waits for `expenses`, calls `AddPostgresPersistence`, and maps accounts and expenses through EF Core 10/Npgsql. Versioned migrations are applied at API startup only in Development and Testing; other environments apply reviewed migrations separately. AppHost supplies a generated signing-key secret persisted in user secrets. Never commit real credentials or keys.
- API integration tests use Testcontainers PostgreSQL with real migrations and disposable data. Docker is required. Preserve coverage for restart persistence, duplicate-email races, and token validation; do not substitute an in-memory repository as proof of database behavior.
- Messaging and Kubernetes are planned learning areas. Add them with a feature or learning milestone that defines their purpose.
- Respect `.editorconfig`: UTF-8, LF, four-space C# indentation, `I` interface prefix, and `Async` suffix for asynchronous methods.
- Do not use unexplained numeric literals in production code. Express business limits, security thresholds, conversion factors, timeouts, and storage limits as meaningfully named constants or typed policies owned by the relevant feature/layer. Reuse the same definition in validation, error text, and persistence when they represent the same rule. Use validated configuration for values that genuinely vary by environment; avoid a global catch-all constants class. Obvious structural values (for example zero), package versions, generated migrations/snapshots, and explicit test inputs/expected values may remain literals. This is a repository-wide implementation and code-review rule.
- Keep package versions in `Directory.Packages.props`; package references in project files must omit versions. SDK versions remain SDK declarations.
- Preserve nullable analysis, warnings as errors, `AnalysisMode=All`, and deterministic compilation. Use the built-in .NET analyzers and Sonar; explain any narrowly scoped suppression.
- Tests currently use xUnit v2 (`xunit` 2.9.3). The v3 Visual Studio runner does not imply a v3 test framework. A v3 migration was recommended but has not been implemented or authorized as a task.

## Verification

Run commands from the repository root unless stated otherwise:

```sh
dotnet restore PolandExpenses.slnx
dotnet build PolandExpenses.slnx --no-restore
dotnet test PolandExpenses.slnx --no-build
dotnet format PolandExpenses.slnx --no-restore --verify-no-changes
```

Restore when dependencies change. For code changes, build and run relevant behavior tests; check formatting when source changes. Documentation-only edits need a content and link review, not a full build. Tests should verify business rules, boundary cases, and observable behavior rather than mirror implementation details.

For frontend changes, run `npm run build` and `npm run lint` from `src/PolandExpenses.Web`. The build includes strict TypeScript checks. Use `npm ci` after dependency changes or in a fresh checkout. Do not invent tests for the static placeholder; add behavior tests alongside interactive features.

For AppHost or service-wiring changes, validate through Aspire from `PolandExpenses.AppHost`: start the AppHost, wait for affected resources to become healthy, and inspect relevant logs or telemetry. Use Aspire lifecycle commands rather than `dotnet run`. Stop processes started solely for verification when finished; preserve sessions the user wants running. Report what passed and any checks that could not run.

Sandbox restrictions may block local build-host pipes or Aspire's user-level state directories. Use the environment's normal escalation mechanism when needed rather than changing architecture or weakening checks to work around the sandbox.
