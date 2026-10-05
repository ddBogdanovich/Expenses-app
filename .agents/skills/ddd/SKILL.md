---
name: dotnet-ddd
description: Guides .NET Core application development using Domain-Driven Design with Hexagonal/Clean Architecture. Use when user asks to design aggregates, entities, value objects, domain events, repositories, bounded contexts, or module structure in .NET Core. Also use for CQRS implementation with UseCase/Query handler patterns, outbox pattern setup, or structuring .NET solutions with modular DDD architecture. Do NOT use for simple CRUD applications, basic EF Core queries, raw SQL/Dapper optimization (use sqlserver-expert), or general C# coding questions unrelated to domain modeling.
metadata:
  author: CuongTL
  version: 1.0.0
  category: architecture
---

# .NET Core DDD + Hexagonal/Clean Architecture

This skill guides building .NET Core applications following Domain-Driven Design with
Hexagonal (Ports & Adapters) and Clean Architecture principles.

## When NOT to Use This Skill

- Simple CRUD operations without complex business rules
- Basic EF Core or Dapper query optimization (use `sqlserver-expert`)
- Generic C# coding tasks unrelated to domain architecture
- Frontend or API design without domain modeling aspects

## Skill Interactions

- For SQL query optimization inside QueryHandlers, defer to `sqlserver-expert` skill
- This skill defines the QueryHandler structure; `sqlserver-expert` optimizes the SQL within

---

## Architecture Overview

### Dependency Flow (Inward)

```
Presentation (APIs / Workers)
       │
       ▼
   Application (UseCases, Queries, DTOs)
       │
       ▼
     Domain (Entities, Value Objects, Domain Events, Interfaces)
       │
       ▲
 Infrastructure (Repos, External Services, Adapters)
       │
       ▼
     Core (Shared kernel, Base abstractions)
```

**The dependency rule**: Dependencies always point inward. Domain has ZERO dependencies
on Infrastructure or Application. Infrastructure implements Domain interfaces (Ports & Adapters).

### Modular Solution Structure

Each bounded context is a module with three projects:

```
src/Modules/{ModuleName}/
├── {Namespace}.Application/       # Use Cases, Queries, DTOs, Handlers
│   ├── UseCases/                  # Command-side (write operations)
│   │   └── {Name}UseCase.cs
│   ├── UseCaseHandlers/           # UseCase implementations
│   │   └── {Name}UseCaseHandler.cs
│   ├── Queries/                   # Query-side (read operations)
│   │   └── Get{Name}Query.cs
│   ├── QueryHandlers/             # Query implementations (Dapper)
│   │   └── Get{Name}QueryHandler.cs
│   ├── DTOs/                      # Data Transfer Objects
│   ├── Interfaces/                # Application-level service interfaces
│   └── Helpers/                   # Application utilities
│
├── {Namespace}.Domain/            # Pure domain model
│   ├── Entities/                  # Aggregates and Entities
│   ├── ValueObjects/              # Value Objects
│   ├── Enums/                     # Domain enumerations
│   ├── Events/                    # Domain Events
│   ├── Interfaces/                # Repository interfaces (Ports)
│   └── Exceptions/                # Domain-specific exceptions
│
└── {Namespace}.Infrastructure/    # Adapters
    ├── Repositories/              # Repository implementations (EF Core)
    ├── Services/                  # External service adapters
    └── Persistence/               # DB configurations, migrations
```

Shared layers sit outside modules:

```
src/Core/{Namespace}.Core/              # Base interfaces, shared kernel
src/Infrastructure/{Namespace}.Infrastructure/  # Cross-cutting (DB context, caching, messaging)
src/Presentation/                       # API and Worker entry points
```

---

## CQRS Separation

Strict separation between reads and writes. Read the reference file for complete interface
definitions: `references/core-interfaces.md`

### Write Side: UseCase + UseCaseHandler

UseCases represent business commands. They always use **Repository Pattern** with **EF Core**.

**UseCase** — a data carrier describing the intent:

```csharp
public class CreateInvoiceUseCase : IUseCase
{
    public CreateInvoiceRequest Request { get; }
    public CreateInvoiceUseCase(CreateInvoiceRequest request)
    {
        Request = request ?? throw new ArgumentNullException(nameof(request));
    }
}
```

**UseCaseHandler** — contains the business logic:

```csharp
public class CreateInvoiceUseCaseHandler : IUseCaseHandlerWithInput<CreateInvoiceUseCase>
{
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IUnitOfWork _unitOfWork;

    public CreateInvoiceUseCaseHandler(
        IInvoiceRepository invoiceRepository,
        IUnitOfWork unitOfWork)
    {
        _invoiceRepository = invoiceRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task HandleAsync(CreateInvoiceUseCase useCase)
    {
        var request = useCase.Request;

        // Domain logic — use factory method on Aggregate
        var invoice = Invoice.Create(
            buyerTaxCode: request.BuyerTaxCode,
            sellerTaxCode: request.SellerTaxCode,
            amount: request.Amount
        );

        await _invoiceRepository.AddAsync(invoice);
        await _unitOfWork.CommitAsync();
    }
}
```

**UseCase variants** (choose the right interface):

| Variant | Interface | When |
|---------|-----------|------|
| Input + Output | `IUseCaseHandler<TUseCase, TOutput>` | Command returns result |
| Input only | `IUseCaseHandlerWithInput<TUseCase>` | Fire-and-forget command |
| Output only | `IUseCaseHandlerWithOutput<TOutput>` | Parameterless command |

**Dispatching** via `IUseCaseService`:

```csharp
// In Controller or Worker
await _useCaseService.ExecuteUseCaseAsync(new CreateInvoiceUseCase(request));
```

### Read Side: Query + QueryHandler

Queries are read-only and always use **Dapper** for performance. Never use EF Core for queries.

```csharp
// Query definition
public class GetInvoiceByIdQuery : IQuery<InvoiceDto?>
{
    public Guid InvoiceId { get; }
    public GetInvoiceByIdQuery(Guid invoiceId) => InvoiceId = invoiceId;
}

// Query Handler — uses Dapper, NOT repositories
public class GetInvoiceByIdQueryHandler : IQueryHandler<GetInvoiceByIdQuery, InvoiceDto?>
{
    private readonly IDbConnection _connection;

    public GetInvoiceByIdQueryHandler(IDbConnection connection)
    {
        _connection = connection;
    }

    public async Task<InvoiceDto?> HandleAsync(GetInvoiceByIdQuery query)
    {
        const string sql = """
            SELECT Id, BuyerTaxCode, SellerTaxCode, Amount, Status
            FROM Invoices
            WHERE Id = @InvoiceId
            """;

        return await _connection.QuerySingleOrDefaultAsync<InvoiceDto>(
            sql, new { query.InvoiceId });
    }
}
```

**Dispatching** via `IQueryService`:

```csharp
var invoice = await _queryService.ExecuteAsync(new GetInvoiceByIdQuery(id));
```

---

## Domain Modeling

For complete code patterns (Aggregates, Value Objects, Domain Events, Repository interfaces),
see: `references/domain-patterns.md`

### Key Rules

**Aggregates:**
1. Use **factory methods** (`Create(...)`) — never expose public constructors for creation
2. Use **private setters** — state changes only through behavior methods
3. **Raise domain events** inside factory methods and behavior methods
4. **Validate invariants** at creation and on every state transition
5. Keep aggregates **small** — reference other aggregates by ID, not by navigation property

**Value Objects:**
- Immutable, compared by value — use C# `record` types
- Self-validating in constructor

**Domain Events:**
- Events raised by aggregates, saved to Outbox table in the same transaction
- Published via CDC (Debezium) → Kafka → Consumer workers

**Outbox flow:**
1. Aggregate raises domain event via `AddDomainEvent()`
2. `SaveChangesAsync` interceptor serializes events to `OutboxEvents` table in the SAME transaction
3. CDC (Debezium) captures changes from `OutboxEvents` table
4. Debezium publishes to Kafka topic
5. Consumer workers process the events

**Repository Interfaces (Ports):**
- Repository interfaces live in `Domain/Interfaces/`
- Repository implementations live in `Infrastructure/Repositories/`
- One repository per Aggregate Root
- Repositories work with domain entities, NEVER with DTOs

---

## Error Handling

Use Result pattern as default, with exceptions for truly exceptional cases.

```csharp
public class Result<T>
{
    public bool IsSuccess { get; init; }
    public T? Value { get; init; }
    public string? Error { get; init; }

    public static Result<T> Success(T value) => new() { IsSuccess = true, Value = value };
    public static Result<T> Failure(string error) => new() { IsSuccess = false, Error = error };
}
```

**When to use what:**
- **Result pattern**: Validation failures, business rule violations, expected error paths
- **Exceptions**: Infrastructure failures, unexpected errors, programming bugs
- **DomainException**: Domain invariant violations inside aggregates

---

## Strategic DDD

For guidance on Bounded Context identification, Context Mapping patterns, and
Ubiquitous Language practices, read: `references/strategic-ddd.md`

---

## Common Issues

### User provides incomplete aggregate requirements
Ask for: aggregate name, key properties, business rules, related events.
Do NOT generate code until invariants are clear.

### Namespace mismatch
Always ask user for the module namespace before generating code.
Default pattern: `{CompanyNamespace}.{ModuleName}.{Layer}`

### Over-engineering simple features
If the feature is simple CRUD with no business rules, suggest a simpler approach
without full DDD ceremony. Not everything needs an Aggregate.

---

## Checklist: Creating a New Module

1. Identify the Bounded Context and its Ubiquitous Language
2. Create the three projects: `.Domain`, `.Application`, `.Infrastructure`
3. Define Aggregates with factory methods and domain events
4. Define Repository interfaces in Domain
5. Create UseCases and UseCaseHandlers for write operations
6. Create Queries and QueryHandlers (Dapper) for read operations
7. Implement Repositories with EF Core in Infrastructure
8. Register DI in the Presentation layer
9. Wire up Outbox for domain event publishing
