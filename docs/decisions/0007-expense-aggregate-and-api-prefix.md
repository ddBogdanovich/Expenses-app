# ADR 0007: Small expense aggregate and authenticated ownership

- Status: Accepted
- Date: 2026-11-01
- Supersedes the unprefixed route paths in [ADR 0006](0006-controllers-and-named-policies.md). Its controller and named-policy decisions remain unchanged.

## Context

Feature 2 introduces backend-only expense CRUD. Users must access only their own purchases. The owner requested every endpoint path use `/api`. The existing account aggregate must not grow into an unbounded purchase history.

## Decision

Expense is both an entity (stable identity) and an aggregate root (an independently saved consistency boundary). It references UserAccount by immutable owner ID. It owns positive Money, a purchase date no later than the supplied business date, a required free-text category, optional note, and allowance classification. Try-based domain methods reject invalid changes without partial mutation. Money remains signed; positivity belongs to Expense.

Create, GetById, List, Update, and Delete use thin authorized controllers and concrete scanned handlers. Expected failures use Result. Nullable input fields preserve the difference between omitted values and explicit false/zero. Ownership is absent from input DTOs and comes from ICurrentAccount. Infrastructure reads the validated JWT subject. Both read projections and aggregate loads include owner ID. Foreign IDs return the same NotFound result as missing IDs. Owner ID is also a concurrency predicate on tracked writes; it cannot be reassigned through the aggregate.

IExpenseRepository lives with the aggregate for writes; IExpenseQueries lives in UseCases for no-tracking EF projections. EF converts Money to bigint grosz; purchase dates use PostgreSQL date. A foreign key enforces account existence, a check constraint reinforces amount positivity, and an owner/date index supports listing. PostgreSQL text stores category and note without new arbitrary product limits. A versioned migration adds the table without changing accounts.

IBusinessCalendar supplies today's Europe/Warsaw date using TimeProvider. Domain receives a DateOnly rather than reading server time. No scheduling, messaging, balance calculation, or frontend change is added. All backend routes, including development health routes and Aspire's API probe, use `/api`.

## Alternatives and costs

Putting expenses inside UserAccount would enlarge its loading and transaction boundary for unrelated purchases. A plain CRUD record would need business rules enforced elsewhere; this aggregate keeps invariant checks reusable and framework-independent. The cost is explicit contracts, mapping, and small slice files.

A database global query filter could hide ownership checks but would couple the context to request identity. Explicit owner parameters make the boundary visible and testable; future queries must preserve that discipline. Read projections avoid aggregate tracking; direct database access from handlers would reduce files but break the chosen dependency direction.

Listing currently returns all owned expenses ordered by purchase date descending then ID. Pagination awaits a defined client contract. Concurrent deletion during a write becomes Conflict; there is no client revision/ETag contract or protection against stale concurrent edits. Revision history, text-size product limits, and calculated allowance balances remain future work. The path prefix change intentionally replaces old routes; there are no compatibility aliases.
