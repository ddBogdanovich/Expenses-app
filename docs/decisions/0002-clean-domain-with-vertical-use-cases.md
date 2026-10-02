# ADR 0002: Use a clean domain core with vertical use-case slices

- Status: Accepted
- Date: 2026-09-22

## Context

The application needs a framework-independent domain model for studying DDD, while its HTTP features should remain easy to find and change. A traditional technical-layer layout tends to scatter one use case across controller, service, validator, and mapping folders. Letting every handler use `DbContext` directly would make persistence convenient, but it would also couple application behavior to EF Core and weaken aggregate boundaries.

## Decision

Keep these project boundaries:

- `Domain` contains aggregates, entities, value objects, domain services, domain events, and aggregate-specific repository contracts. It references no web or persistence framework.
- `UseCases` organizes commands and queries by feature. Each feature folder may contain its endpoint, request, handler, validation, response, and mapping code.
- `Infrastructure` implements repositories, persistence, messaging, and integrations. Read-oriented use cases depend on focused query-service contracts rather than aggregate repositories.
- `Api` is the composition root and contains only host configuration.
- `AppHost` is the local distributed-application composition root.

Handlers implement `IUseCaseHandler<TRequest, TResponse>` and endpoints implement `IEndpoint`. Startup scans only these explicit contracts. Endpoints depend directly on their concrete handler; there is no mediator or application-wide dispatcher.

Expected business outcomes use `Result` and `UseCaseError`, such as validation failure, a missing expense, or an edit conflict. Programming errors, unavailable infrastructure, and broken invariants remain exceptions.

Repository contracts will be introduced with the aggregate that needs them. They will be aggregate-specific rather than a generic `IRepository<T>`. Query services may use EF Core projections directly inside `Infrastructure` and return purpose-built read models.

## Consequences

A feature can be read mostly within one folder while the domain remains independent of ASP.NET Core and EF Core. Writes retain explicit aggregate boundaries, and reads avoid loading rich aggregates when a projection is enough.

This creates more projects and contracts than a minimal CRUD application. Reflection-based registration is limited and testable, but it is still less explicit than registering every handler manually. The architecture should be simplified if these boundaries stop protecting real product behavior.
