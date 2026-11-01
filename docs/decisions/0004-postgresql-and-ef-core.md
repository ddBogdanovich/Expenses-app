# ADR 0004: PostgreSQL and EF Core persistence foundation

- Status: Accepted; independent-resource and empty-context milestone superseded by [ADR 0005](0005-account-authentication.md)
- Date: 2026-10-06

## Context

The owner requested PostgreSQL and EF Core ahead of the first persistence-backed feature, including an independent Aspire resource with no application consumers yet. The clean domain and vertical-use-case boundaries from ADR 0002 still apply.

## Decision

Use `Aspire.Hosting.PostgreSQL` at the AppHost's existing integration version. Declare a `postgres` server and an `expenses` logical database with a Docker data volume. Retain the session container lifetime so stopping the AppHost stops the container while preserving the data.

Infrastructure references the EF Core 10 Npgsql provider and contains an empty `ExpensesDbContext` configured through constructor-injected options. An opt-in `AddPostgresPersistence` extension selects Npgsql and registers the context with a scoped lifetime. The API does not call it. Domain and UseCases acquire no EF Core dependencies.

Do not add application `WithReference` or `WaitFor` edges, hardcoded connection strings, schema migrations, sample entities, or startup schema creation in this milestone. The first persisted use case will introduce mappings, aggregate-specific repository implementations, focused query services, and migration tooling as needed.

## Consequences

The local database is available for learning and inspection without changing API behavior. Data survives AppHost sessions, but developers need a container runtime and must manage their local volume. Aspire handles local credentials and ports; this does not establish production deployment, backup, or credential policies.

PostgreSQL offers a production database with transactions and relational constraints. SQLite would have lower operational cost for a personal app, but would not teach container orchestration or PostgreSQL behavior. EF Core provides LINQ, change tracking, and migrations; direct Npgsql or Dapper would make SQL more explicit at the cost of additional mapping and schema-management work. EF Core still requires understanding generated SQL and transaction boundaries.
