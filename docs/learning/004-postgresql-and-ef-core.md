# Learning note 004: PostgreSQL, EF Core, and Aspire

## Three tools, three responsibilities

**PostgreSQL** is the database server. It stores data and enforces database transactions and constraints. A server can host multiple logical databases; ours is `expenses` inside the `postgres` server resource.

**EF Core** is an object-relational mapper (ORM): it maps .NET objects to relational tables and translates supported LINQ queries to SQL. **Npgsql** supplies the PostgreSQL driver and EF Core provider. Our provider package is `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3, which brings compatible EF Core 10 dependencies. Aspire hosting packages follow the AppHost's separate 13.5.4 version line.

**Aspire** describes and starts the local resource graph. Adding a database resource does not make the API use EF Core. Orchestration and application persistence are separate decisions.

## What exists now

```text
AppHost
  api -> expenses     account and expense persistence consumer
  web                 independent application
  postgres            container + data volume
    expenses          logical database

Infrastructure
  Persistence/ExpensesDbContext.cs
  Persistence/PersistenceServiceCollectionExtensions.cs
```

The database is structurally a child of its server. The API now references and waits for it, calls `AddPostgresPersistence`, and maps `UserAccount` and `Expense` through Infrastructure. Both have versioned migrations. The frontend remains independent.

## What a DbContext does

`ExpensesDbContext` is our EF Core session. It maps accounts and expenses, executes queries, tracks changes, and persists them through `SaveChangesAsync`. The options supplied to its constructor select the provider and connection configuration; the context does not contain a password or decide where PostgreSQL runs.

The change tracker remembers loaded entities and detects their modifications. Saving related changes together implements the **Unit of Work** pattern: coordinate a set of changes before committing them. With a relational provider, a single `SaveChangesAsync` normally uses a transaction when required. Separate saves or external messages are not automatically one transaction.

Our opt-in registration uses `AddDbContext`, whose default lifetime is **scoped**: when used in ASP.NET Core, a request normally gets its own context. A context is not thread-safe and must not be shared across concurrent operations or captured by a singleton. Background workers will need their own scopes or a context factory.

The mapped aggregates are `UserAccount` and `Expense`. Expense money maps to bigint grosz and purchase dates to PostgreSQL date. `BudgetPlan` remains planned.

## How this fits DDD

The domain owns rules such as positive expense amounts and signed allowance balances. EF Core does not define those rules. It will adapt domain types to storage in Infrastructure; for example, `Money.Grosz` can map to a PostgreSQL `bigint` while currency and checked arithmetic remain domain concerns.

Aggregate-specific repositories will load and save consistency boundaries. Focused query services can use projections and `AsNoTracking` for calendar screens. Their contracts live in Domain and UseCases respectively; EF Core implementations stay in Infrastructure. We retain these boundaries rather than exposing `DbContext` to handlers.

## Data lifetime and schema lifetime

Run from `PolandExpenses.AppHost` with Docker running:

```shell
aspire start
aspire wait postgres
aspire wait expenses
aspire stop
```

`WithDataVolume` keeps database files beyond the container's lifetime. The default session lifetime stops the container when Aspire stops; a persistent container lifetime would instead keep it running. Keeping data and keeping a process alive are different choices. A volume is not a backup, and deleting it deletes its data.

Aspire manages credentials and the assigned local port. Inspect the database resource's connection string privately in the dashboard when using a database client; do not paste it into source control. Retain the same password for an existing volume: the PostgreSQL image's initialization password is applied when its data directory is first created, not changed by reinitializing a populated directory.

**Migrations** are versioned changes to the schema, such as creating an expenses table. Authentication introduced migration tooling and the account schema. Development and Testing apply `MigrateAsync` at startup; other environments require reviewed migrations to be applied separately. We do not use `EnsureCreated`. See [ADR 0005](../decisions/0005-account-authentication.md).

## Costs and alternatives

SQLite would avoid the server/container dependency. PostgreSQL gives us a realistic database to study transactions, query plans, and local orchestration. Dapper or direct Npgsql would keep SQL explicit but require more manual mapping. EF Core reduces that work while adding query translation and tracking behavior we must understand and measure.

## Check your understanding

1. Why is `WithReference(expenses)` insufficient without API persistence registration and account mappings?
2. What survives `aspire stop`: the context, container process, or volume data?
3. Why should an aggregate repository use a context internally rather than expose it to the domain?
4. Why does one context per request not automatically make every operation in that request a single transaction?
5. Inspect ExpenseConfiguration: how does signed `Money` map to a bigint column while expense positivity is enforced separately?

## References

- [Aspire PostgreSQL hosting](https://aspire.dev/integrations/databases/postgres/postgres-host/)
- [Npgsql EF Core provider](https://www.npgsql.org/efcore/)
- [EF Core context lifetime and configuration](https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/)
- [ADR 0004](../decisions/0004-postgresql-and-ef-core.md)
