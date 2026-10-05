# Strategic DDD Reference

Guidance for Bounded Context identification, Context Mapping, and Ubiquitous Language.

## Table of Contents

1. [Bounded Contexts](#bounded-contexts)
2. [Context Mapping](#context-mapping)
3. [Ubiquitous Language](#ubiquitous-language)
4. [Identifying Boundaries](#identifying-boundaries)

---

## Bounded Contexts

A Bounded Context is an explicit boundary within which a domain model exists. Each module
in the solution represents one (or more) bounded contexts.

**Example from KvEInvoice:**

| Module | Bounded Context | Responsibility |
|--------|----------------|----------------|
| Iam | Identity & Access | Authentication, authorization, user management |
| Invoice | Invoice Management | Core invoice lifecycle (create, edit, sign, issue) |
| Operation/KvEinvoice | EInvoice Operations | EInvoice-specific operational workflows |
| Operation/KvAccountingTax | Accounting-Tax | Accounting and tax reporting operations |
| Tax | Tax Authority Integration | Communication with T2B/GIP tax systems |
| Taxation | Tax Computation | Tax calculation, declaration, submission |
| Tvan | T-VAN Transmission | Electronic transmission channel to tax authority |

**One module can contain multiple bounded contexts** (see Operation module with KvEinvoice
and KvAccountingTax). Each bounded context gets its own Application/Domain/Infrastructure triplet.

### Rules for Bounded Contexts

1. **Each bounded context owns its data** — no direct DB access across contexts
2. **Communication between contexts** via domain events (Outbox → Kafka) or application services
3. **No shared domain models** — each context defines its own entities, even if concepts overlap
4. **Shared Kernel** (Core project) contains only truly universal abstractions (interfaces, base classes)

---

## Context Mapping

Context Map defines the relationships between bounded contexts.

### Relationship Patterns

**Upstream/Downstream (U/D):**

```
Invoice (U) ──publishes──▶ Tax (D)
    InvoiceSubmittedEvent  →  triggers tax computation
```

**Anti-Corruption Layer (ACL):**

```
Tvan (our context)
    │
    └── ACL ──adapts──▶ TCT External System (tax authority)
         Translates TCT XML formats to our domain model
```

**Shared Kernel:**

```
Core project
    │
    ├── IUseCase, IQuery, IUseCaseService, IQueryService
    ├── BaseEntity, IHasDomainEvents
    └── Common utilities
```

**Customer-Supplier:**

```
Invoice (Supplier) ◄──requests──  Operation (Customer)
    Operation depends on Invoice's published API
    Invoice team accommodates Operation's needs
```

### When to use each pattern

| Pattern | Use When |
|---------|----------|
| **Published Language** | External API (OpenApi module) — well-defined contract |
| **Anti-Corruption Layer** | Integrating with external/legacy systems (TCT, T-VAN) |
| **Shared Kernel** | Truly shared concepts (base interfaces in Core) — keep minimal |
| **Customer-Supplier** | One team depends on another's output |
| **Conformist** | Must match external system's model exactly (tax authority formats) |
| **Separate Ways** | Contexts have no meaningful relationship |

---

## Ubiquitous Language

Each bounded context has its own language. The same real-world concept may have different
names and meanings in different contexts.

### Establishing Ubiquitous Language

1. **Domain experts define the terms** — developers adopt their language, not the other way around
2. **Document the glossary** per bounded context
3. **Code reflects the language** — class names, method names, property names match domain terms
4. **Reject technical jargon** in the domain layer — no "DTO", "Repository", "Service" in entity names

### Example: "Invoice" across contexts

| Context | Term | Meaning |
|---------|------|---------|
| Invoice | `Invoice` | Full invoice entity with line items and lifecycle |
| Tax | `TaxDocument` | Invoice data relevant for tax computation only |
| Tvan | `SendRecord` | A message record for transmission to tax authority |
| Operation | `InvoiceOperation` | Operational state and audit trail of invoice processing |

### Language in Code

```csharp
// GOOD — uses domain language
public class Invoice
{
    public void Submit() { ... }           // Domain term
    public void IssueWithCode() { ... }    // Vietnamese tax domain term
    public bool CanBeVoided() { ... }      // Business rule as question
}

// BAD — uses technical language
public class InvoiceEntity
{
    public void UpdateStatus() { ... }     // Generic, meaningless
    public void Process() { ... }          // What does "process" mean?
    public bool IsValid() { ... }          // Valid for what?
}
```

---

## Identifying Boundaries

### Discovery Techniques

**Event Storming** (recommended):
1. Identify domain events (orange sticky notes): "Invoice Created", "Invoice Submitted"
2. Group events by business process
3. Identify commands that trigger events (blue): "Submit Invoice"
4. Identify aggregates that handle commands (yellow): "Invoice"
5. Draw boundaries around cohesive groups → these are your bounded contexts

**Heuristics for splitting:**
- Different stakeholders or domain experts → likely different contexts
- Different rate of change → split
- Different data consistency requirements → split
- Different deployment requirements → split
- Terms mean different things to different people → definitely split

### Anti-patterns to avoid

- **God Context**: One module does everything — split by business capability
- **Premature splitting**: Don't split until you understand the domain well
- **Shared domain models**: Entity reuse across contexts creates tight coupling
- **Infrastructure-driven boundaries**: Split by business domain, not by technical layers