# Learning note 002: Project foundations and vertical slices

## Why do this before adding features?

Repository-wide defaults are cheapest to establish while the codebase is small. They turn decisions about nullability, warnings, dependency versions, and formatting into executable rules. Without them, every project can quietly acquire different settings and the build may behave differently from an editor.

These rules are guardrails, not architecture. They improve feedback, but they do not decide whether a domain model is useful or a project boundary is justified.

## `Directory.Build.props`: one compiler policy

MSBuild automatically imports `Directory.Build.props` into projects below it. Our file enables:

- nullable reference-type analysis;
- the full built-in .NET analyzer set;
- code-style checks during builds;
- warnings as errors;
- deterministic output.

The benefit is consistency: a warning cannot be ignored in one project and fail CI in another. The cost is visible during setup. Templates and public APIs trigger rules that a default build would not report. We fix those findings when they improve the design and suppress a rule only when we can explain why it is wrong for a specific location.

## Central Package Management: one dependency catalog

`Directory.Packages.props` owns package versions for the whole repository. Project files state which packages they need without repeating versions. `CentralPackageVersionOverrideEnabled` is disabled so a project cannot silently drift from the catalog.

This centralizes versions, not dependencies. A project still declares its own `PackageReference`, so its responsibilities remain visible.

`SonarAnalyzer.CSharp` is a global package reference, which applies it to every project. We deliberately use the built-in .NET analyzers plus Sonar only. Adding overlapping analyzer packs would produce duplicate findings and spend attention on reconciling rule sets rather than learning from them.

## `.editorconfig`: source-controlled editor behavior

`.editorconfig` defines UTF-8, line endings, indentation, the `I` prefix for interfaces, and the `Async` suffix rule for asynchronous methods. IDE settings are personal; `.editorconfig` is part of the repository and can be enforced by the build.

Naming rules carry meaning. `HandleAsync` tells a caller that the operation returns a task and may suspend. `IEndpoint` distinguishes a contract from its implementation. Naming alone cannot create a good abstraction, so an interface must still represent useful behavior.

## Clean Architecture and vertical slices solve different problems

Clean Architecture controls dependency direction. The domain is central and framework-independent; outer projects adapt databases, messaging, and HTTP to it.

Vertical slices control how application behavior is organized. One feature stays together instead of being split into global folders such as Controllers, Services, Validators, and Mappers.

They combine naturally:

```text
HTTP request
    -> feature endpoint
    -> feature handler
    -> domain behavior
    -> repository or query-service contract
    -> infrastructure implementation
```

The first real feature might eventually look like this:

```text
UseCases/
  Expenses/
    RecordExpense/
      RecordExpense.Endpoint.cs
      RecordExpense.Request.cs
      RecordExpense.Handler.cs
      RecordExpense.Validation.cs
```

This is a shape, not a requirement to create empty folders. We will introduce it with an actual use case so every file has a reason to exist.

## Why retain repositories for writes?

An aggregate is a consistency boundary: changes inside it must preserve its invariants as one unit. An aggregate-specific repository expresses loading and saving that boundary in domain terms. For example, a future `IExpenseLedgerRepository` can expose exactly what the ledger needs without leaking EF Core query behavior across the application.

A generic `IRepository<T>` often adds little beyond `DbSet<T>` and hides useful persistence capabilities. We will avoid it.

Reads have a different goal. A calendar screen may need a projection of dates, daily totals, and balances rather than a graph of domain objects. A focused query service can return that shape efficiently without pretending that a report is an aggregate.

## Why no MediatR or AutoMapper?

An endpoint can call its handler directly. A project-wide mediator would add dispatch and pipeline concepts before we need them. If cross-cutting handler behaviors later become difficult to manage, that concrete pressure gives us a reason to reconsider.

Mapping is code with product meaning, especially when money, dates, and local time are involved. Explicit functions keep those decisions searchable and debuggable. Automated mapping becomes useful only when repetitive, mechanical mapping outweighs its implicit behavior.

## What `Result` means here

`Result<T>` makes expected alternative outcomes explicit in a handler's return type. The HTTP adapter maps known failures to status codes.

It is not a replacement for exceptions. A database connection failure is not a business alternative that every use case should pretend to handle. A violated internal invariant is a defect. Those conditions should still fail through the exception and observability pipeline.

The factory methods live on the non-generic `Result` type:

```csharp
Result.Success(response);
Result.Failure<Response>(error);
```

This also keeps construction valid: callers cannot create a “successful” result that contains an error.

## Aspire and OpenTelemetry from day one

The AppHost starts the API as a resource and checks its `/health` endpoint. It also starts the empty Vite frontend and checks `/`; see [Learning note 003](003-react-frontend-foundation.md) for that setup. `ServiceDefaults` adds service discovery, standard HTTP resilience, health checks, and OpenTelemetry instrumentation to the API. The API now references and waits for PostgreSQL for account persistence; a broker is still planned.

At the owner's request, the database and EF Core foundation precede the first persistence-backed feature. This learning step distinguishes orchestration from application persistence: Aspire owns the server and database, while Infrastructure owns the ORM. Authentication is now the first persistence-backed feature, with an account schema, migration, and repository; see [Learning note 006](006-account-authentication.md).

## Check your understanding

1. Why does centralizing a package version not hide which project uses that package?
2. What different problems do Clean Architecture and vertical slices solve?
3. Why is an aggregate repository useful for writes but often inefficient for calendar queries?
4. Which failures belong in `Result`, and which should remain exceptions?
5. Why is controlled contract scanning safer than registering every discovered class?
