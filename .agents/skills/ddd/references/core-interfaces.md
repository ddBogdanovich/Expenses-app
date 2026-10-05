# Core Interfaces Reference

Complete interface definitions from the Core shared kernel. These interfaces form the
foundation of the CQRS + UseCase pattern.

## Table of Contents

1. [UseCase Interfaces](#usecase-interfaces)
2. [UseCaseHandler Interfaces](#usecasehandler-interfaces)
3. [UseCaseService Interface](#usecaseservice-interface)
4. [Query Interfaces](#query-interfaces)
5. [QueryHandler Interface](#queryhandler-interface)
6. [QueryService Interface](#queryservice-interface)
7. [UnitOfWork Interface](#unitofwork-interface)
8. [Domain Event Interfaces](#domain-event-interfaces)

---

## UseCase Interfaces

```csharp
namespace KvEInvoice.Core.Interfaces;

/// <summary>
/// Base marker interface for all Use Cases
/// </summary>
public interface IUseCase { }

/// <summary>
/// Use Case with input and output
/// </summary>
public interface IUseCase<in TInput, TOutput> : IUseCase
{
    Task<TOutput> ExecuteAsync(TInput input);
}

/// <summary>
/// Use Case with input only (no return value)
/// </summary>
public interface IUseCaseWithInput<in TInput> : IUseCase
{
    Task ExecuteAsync(TInput input);
}

/// <summary>
/// Use Case with output only (no input parameters)
/// </summary>
public interface IUseCaseWithOutput<TOutput> : IUseCase
{
    Task<TOutput> ExecuteAsync();
}
```

**Convention**: UseCase classes are data carriers (like commands). They hold the request
data and implement `IUseCase` (marker interface). The actual logic lives in the Handler.

```csharp
// CORRECT — UseCase as data carrier
public class PersistSendRecordUseCase : IUseCase
{
    public PersistSendRecordRequest Request { get; }
    public PersistSendRecordUseCase(PersistSendRecordRequest request)
    {
        Request = request ?? throw new ArgumentNullException(nameof(request));
    }
}
```

---

## UseCaseHandler Interfaces

```csharp
namespace KvEInvoice.Core.Interfaces;

/// <summary>
/// Base marker interface for all use case handlers
/// </summary>
public interface IUseCaseHandler { }

/// <summary>
/// Handler with input (UseCase) and output
/// </summary>
public interface IUseCaseHandler<in TUseCase, TOutput> : IUseCaseHandler
    where TUseCase : IUseCase
{
    Task<TOutput> HandleAsync(TUseCase useCase);
}

/// <summary>
/// Handler with input only (UseCase, no return value)
/// </summary>
public interface IUseCaseHandlerWithInput<in TUseCase> : IUseCaseHandler
    where TUseCase : IUseCase
{
    Task HandleAsync(TUseCase useCase);
}

/// <summary>
/// Handler with output only (no input UseCase)
/// </summary>
public interface IUseCaseHandlerWithOutput<TOutput> : IUseCaseHandler
{
    Task<TOutput> HandleAsync();
}
```

**Choosing the right handler interface:**

| Scenario | Interface | Example |
|----------|-----------|---------|
| Create/Update entity, return ID | `IUseCaseHandler<TUseCase, TOutput>` | CreateInvoice → returns Guid |
| Process command, no return | `IUseCaseHandlerWithInput<TUseCase>` | PersistSendRecord → void |
| Trigger action, return status | `IUseCaseHandlerWithOutput<TOutput>` | HealthCheck → returns StatusDto |

---

## UseCaseService Interface

The dispatcher — resolves and executes the appropriate handler via DI.

```csharp
namespace KvEInvoice.Core.Interfaces;

public interface IUseCaseService
{
    // Direct execution methods
    Task<TOutput> ExecuteAsync<TInput, TOutput>(TInput input);
    Task ExecuteAsync<TInput>(TInput input);
    Task<TOutput> ExecuteAsync<TOutput>();

    // Handler-based execution methods (preferred)
    Task<TOutput> ExecuteUseCaseAsync<TUseCase, TOutput>(TUseCase useCase)
        where TUseCase : IUseCase;
    Task ExecuteUseCaseAsync<TUseCase>(TUseCase useCase)
        where TUseCase : IUseCase;
}
```

**Usage in controllers:**

```csharp
// Preferred — handler-based
await _useCaseService.ExecuteUseCaseAsync(new CreateInvoiceUseCase(request));

// Also valid — direct execution
var result = await _useCaseService.ExecuteAsync<CreateInvoiceRequest, Guid>(request);
```

---

## Query Interfaces

```csharp
namespace KvEInvoice.Core.Interfaces;

/// <summary>
/// Base interface for all queries. TResult defines the return type.
/// </summary>
public interface IQuery<TResult> { }
```

**Convention**: Query classes are immutable data carriers with the query parameters.

```csharp
public class GetInvoicesByTaxCodeQuery : IQuery<List<InvoiceDto>>
{
    public string TaxCode { get; }
    public int Page { get; }
    public int PageSize { get; }

    public GetInvoicesByTaxCodeQuery(string taxCode, int page = 1, int pageSize = 20)
    {
        TaxCode = taxCode;
        Page = page;
        PageSize = pageSize;
    }
}
```

---

## QueryHandler Interface

```csharp
namespace KvEInvoice.Core.Interfaces;

public interface IQueryHandler<TQuery, TResult> where TQuery : IQuery<TResult>
{
    Task<TResult> HandleAsync(TQuery query);
}
```

**CRITICAL RULE**: QueryHandlers always use **Dapper** with raw SQL. Never use EF Core
or repositories in query handlers.

```csharp
public class GetInvoicesByTaxCodeQueryHandler
    : IQueryHandler<GetInvoicesByTaxCodeQuery, List<InvoiceDto>>
{
    private readonly IDbConnection _connection;

    public GetInvoicesByTaxCodeQueryHandler(IDbConnection connection)
    {
        _connection = connection;
    }

    public async Task<List<InvoiceDto>> HandleAsync(GetInvoicesByTaxCodeQuery query)
    {
        const string sql = """
            SELECT Id, BuyerTaxCode, SellerTaxCode, Amount, Status
            FROM Invoices
            WHERE SellerTaxCode = @TaxCode
            ORDER BY CreatedDate DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
            """;

        var result = await _connection.QueryAsync<InvoiceDto>(sql, new
        {
            query.TaxCode,
            Offset = (query.Page - 1) * query.PageSize,
            query.PageSize
        });

        return result.ToList();
    }
}
```

---

## QueryService Interface

```csharp
namespace KvEInvoice.Core.Interfaces;

public interface IQueryService
{
    Task<TResult> ExecuteAsync<TResult>(IQuery<TResult> query);
}
```

**Usage:**

```csharp
var invoices = await _queryService.ExecuteAsync(
    new GetInvoicesByTaxCodeQuery("0101234567"));
```

---

## UnitOfWork Interface

```csharp
namespace KvEInvoice.Core.Interfaces;

public interface IUnitOfWork
{
    Task<int> CommitAsync(CancellationToken cancellationToken = default);
    Task BeginTransactionAsync(CancellationToken cancellationToken = default);
    Task RollbackTransactionAsync(CancellationToken cancellationToken = default);
    Task CommitTransactionAsync(CancellationToken cancellationToken = default);
}
```

**Usage patterns:**

```csharp
// Simple commit (most common in UseCaseHandlers)
await _repository.AddAsync(entity);
await _unitOfWork.CommitAsync();

// Explicit transaction (when multiple aggregates or outbox is involved)
await _unitOfWork.BeginTransactionAsync();
try
{
    await _repository.AddAsync(entity);
    // Domain events → OutboxEvents saved in same transaction via interceptor
    await _unitOfWork.CommitAsync();
    await _unitOfWork.CommitTransactionAsync();
}
catch
{
    await _unitOfWork.RollbackTransactionAsync();
    throw;
}
```

---

## Domain Event Interfaces

```csharp
public interface IDomainEvent
{
    DateTime OccurredOn { get; }
}

public interface IHasDomainEvents
{
    IReadOnlyCollection<IDomainEvent> DomainEvents { get; }
    void AddDomainEvent(IDomainEvent domainEvent);
    void RemoveDomainEvent(IDomainEvent domainEvent);
    void ClearDomainEvents();
}
```

**Pattern for domain events in aggregates:**

```csharp
public class MyAggregate : BaseEntity, IHasDomainEvents
{
    private readonly List<IDomainEvent> _domainEvents = new();

    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();
    public void AddDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);
    public void RemoveDomainEvent(IDomainEvent domainEvent) => _domainEvents.Remove(domainEvent);
    public void ClearDomainEvents() => _domainEvents.Clear();

    public static MyAggregate Create(/* params */)
    {
        var entity = new MyAggregate { /* set properties */ };
        entity.AddDomainEvent(new MyAggregateCreatedEvent(entity.Id));
        return entity;
    }
}
```

**Outbox flow**: Domain events are collected from aggregates during `SaveChangesAsync`,
serialized to the `OutboxEvents` table in the same DB transaction, then captured by
CDC (Debezium) and published to Kafka for consumer workers to process.