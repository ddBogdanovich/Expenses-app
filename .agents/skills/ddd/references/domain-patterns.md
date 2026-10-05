# Domain Patterns Reference

Complete code patterns for Aggregates, Value Objects, Domain Events, and Repository interfaces.

## Table of Contents

1. [Aggregate Pattern](#aggregate-pattern)
2. [Value Objects](#value-objects)
3. [Domain Events](#domain-events)
4. [Repository Interfaces](#repository-interfaces)

---

## Aggregate Pattern

Aggregates are the consistency boundary. Use factory methods for creation to enforce invariants
and raise domain events.

```csharp
public class Invoice : BaseEntity, IHasDomainEvents
{
    private readonly List<IDomainEvent> _domainEvents = new();

    // Properties — private setters enforce invariants
    public Guid Id { get; private set; }
    public string BuyerTaxCode { get; private set; } = string.Empty;
    public string SellerTaxCode { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public InvoiceStatus Status { get; private set; }

    // IHasDomainEvents
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();
    public void AddDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);
    public void RemoveDomainEvent(IDomainEvent domainEvent) => _domainEvents.Remove(domainEvent);
    public void ClearDomainEvents() => _domainEvents.Clear();

    // Factory method — the ONLY way to create
    public static Invoice Create(string buyerTaxCode, string sellerTaxCode, decimal amount)
    {
        // Guard clauses / invariant validation
        if (string.IsNullOrWhiteSpace(buyerTaxCode))
            throw new DomainException("Buyer tax code is required");

        var invoice = new Invoice
        {
            Id = Guid.NewGuid(),
            BuyerTaxCode = buyerTaxCode,
            SellerTaxCode = sellerTaxCode,
            Amount = amount,
            Status = InvoiceStatus.Draft
        };

        invoice.AddDomainEvent(new InvoiceCreatedEvent(invoice.Id));
        return invoice;
    }

    // Behavior methods — express business rules
    public void Submit()
    {
        if (Status != InvoiceStatus.Draft)
            throw new DomainException("Only draft invoices can be submitted");

        Status = InvoiceStatus.Submitted;
        AddDomainEvent(new InvoiceSubmittedEvent(Id));
    }
}
```

### Aggregate Template

```csharp
public class {AggregateName} : BaseEntity, IHasDomainEvents
{
    private readonly List<IDomainEvent> _domainEvents = new();

    // Properties
    public Guid Id { get; private set; }
    // ... add domain properties with private setters

    // IHasDomainEvents implementation
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();
    public void AddDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);
    public void RemoveDomainEvent(IDomainEvent domainEvent) => _domainEvents.Remove(domainEvent);
    public void ClearDomainEvents() => _domainEvents.Clear();

    // Factory method
    public static {AggregateName} Create(/* required params */)
    {
        // Validate invariants
        // Create entity
        // Raise creation event
        // Return entity
    }

    // Behavior methods
    public void {BusinessAction}()
    {
        // Check preconditions
        // Apply state change
        // Raise domain event
    }
}
```

---

## Value Objects

Immutable objects with no identity, compared by value. Use C# `record` types.

```csharp
public record Money(decimal Amount, string Currency)
{
    public static Money VND(decimal amount) => new(amount, "VND");

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new DomainException("Cannot add different currencies");
        return new Money(Amount + other.Amount, Currency);
    }
}

public record TaxCode
{
    public string Value { get; }

    public TaxCode(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 14)
            throw new DomainException("Invalid tax code");
        Value = value;
    }
}
```

### Value Object Guidelines

- Always self-validate in constructor
- Immutable — all properties are read-only
- Compared by value, not by reference
- No side effects in methods — return new instances
- Use `record` for simple cases, `class` with `Equals/GetHashCode` for complex cases

---

## Domain Events

Events raised by aggregates, saved to Outbox table in the same transaction, then published
via CDC (Debezium) → Kafka → Consumer workers.

```csharp
public interface IDomainEvent
{
    DateTime OccurredOn { get; }
}

public record InvoiceCreatedEvent(Guid InvoiceId) : IDomainEvent
{
    public DateTime OccurredOn { get; } = DateTime.UtcNow;
}
```

### Event Naming Convention

- Past tense: `InvoiceCreated`, `OrderShipped`, `PaymentProcessed`
- Include aggregate ID as primary payload
- Add only essential data — consumers can query for details

---

## Repository Interfaces

Defined in the **Domain** layer. Implemented in **Infrastructure** (Adapters).

```csharp
// Domain/Interfaces/IInvoiceRepository.cs
public interface IInvoiceRepository
{
    Task<Invoice?> GetByIdAsync(Guid id);
    Task AddAsync(Invoice invoice);
    Task UpdateAsync(Invoice invoice);
}
```

### Repository Rules

- Repository interfaces live in `Domain/Interfaces/`
- Repository implementations live in `Infrastructure/Repositories/`
- One repository per Aggregate Root
- Repositories work with domain entities, NEVER with DTOs
- Use EF Core in implementations (write side only)
