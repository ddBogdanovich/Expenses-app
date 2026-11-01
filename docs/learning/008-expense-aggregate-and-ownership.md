# Learning note 008: Expense aggregates and ownership

## Entity and aggregate root

An entity has identity through time. Correcting Lunch from 3500 grosz to 4000 grosz changes the same Expense; it does not create a new purchase. An aggregate is the boundary saved consistently as a unit. Expense is both: a root containing one entity and Money, with no child entities yet. Aggregate does not mean a collection.

UserAccount references are IDs. Loading an account's full lifetime purchase history just to edit Lunch would make the account aggregate unnecessarily large. The alternative, a plain persistence record validated only by a controller, is smaller initially but lets non-HTTP callers bypass the rules.

## Follow one write

1. `POST /api/expenses` reaches `UseCases/Expenses/Create/CreateExpenseController.cs`. `[Authorize]` requires bearer authentication; MVC handles malformed JSON and incorrect scalar types.
2. `CreateExpenseHandler` obtains the owner through `ICurrentAccount`, not from JSON. Nullable fields let the handler reject missing `qualifiesForAllowance` while accepting explicit `false`.
3. `IBusinessCalendar` supplies today's Warsaw date. The domain `Expense.TryCreate` rejects nonpositive Money, missing dates, future dates, and blank categories. Category is trimmed; note may be null.
4. `IExpenseRepository` persists the aggregate with EF Core. Its configuration converts Money to bigint grosz, preserving exact integers. PostgreSQL also enforces a positive amount and an existing account.
5. Explicit mapping produces only purchase fields and ID, then HTTP 201 with a prefixed Location.

`PUT` replaces the full purchase details, retaining ID and owner. `TryUpdate` validates everything before assigning any fields; a rejected edit cannot partially change classification or date. Backdating to December 31 is valid even when today is in the next year. There is no BudgetPlan calculation yet.

## Authentication is only the first half

Authentication proves who submitted a request. Authorization decides whether that account may operate on this expense. `[Authorize]` alone would let any signed-in user retrieve another person's purchase if a handler looked up only its ID.

Both `ExpenseQueries` and `ExpenseRepository.FindAsync` filter on owner and expense IDs. The aggregate exposes no ownership-changing method. EF also includes owner ID in update/delete predicates. Supplying `ownerId` or `accountId` in JSON cannot transfer a purchase because those properties are not in the input DTO. A foreign expense returns 404, the same as an unknown ID.

Explicit owner predicates are easy to inspect but require discipline on every new query. A global EF query filter is an alternative; it hides repetition but makes database queries depend on ambient identity. PostgreSQL row-level security would add a further boundary and connection/session management costs that this feature does not yet need.

## Clocks, dates, and persistence

JWT expiry uses UTC instants. Purchase dates are DateOnly business dates. `WarsawBusinessCalendar` converts TimeProvider UTC time through Europe/Warsaw before extracting the date, including daylight saving changes. Domain methods take today's date explicitly so tests need no real clock.

EF value conversion keeps the domain free of database annotations. Read queries project into ExpenseResponse without tracking. Writes load a tracked aggregate and save its state. A concurrent deletion is mapped to Conflict; client revision checks and stale-edit prevention are not implemented. The list is currently unpaginated. These are explicit contract limits, not reasons to add infrastructure without a use case.

See [EF value conversion](https://learn.microsoft.com/en-us/ef/core/modeling/value-conversions) and [EF concurrency behavior](https://learn.microsoft.com/en-us/ef/core/saving/concurrency) for the framework mechanisms behind these mappings and write outcomes.

## Tests and exercises

`tests/PocketLedger.Api.Tests/ExpenseTests.cs` checks CRUD, required and invalid inputs, two-user isolation, owner-field spoofing, backdating, and persistence across real API hosts using disposable PostgreSQL and production migrations. Domain tests exercise identity, positive Money, future dates, and rejected updates without a database. No tests are skipped or replaced with production stubs.

Run the repository's build, test, and format commands. API tests require Docker. New schema migrations run automatically in Development and Testing only; other environments require reviewed SQL. No new package or deployable service was needed.

1. Explain why a one-entity aggregate still provides a useful consistency boundary.
2. Trace what happens when account B sends PUT for account A's expense ID.
3. Why must `false` and an omitted allowance classification have different meanings?
4. At 23:30 UTC in winter, which purchase date counts as today in Warsaw?
5. Design a future pagination or revision-check contract before implementing it. Which existing HTTP tests would change?

## Verification result

The solution builds with zero warnings/errors. All 83 tests pass: 20 domain, 3 shared use-case Result tests, and 60 PostgreSQL-backed HTTP/calendar cases. This includes deterministic Warsaw dates before and after daylight saving transitions. Formatting and local documentation links pass; EF reports no pending model changes. The reviewed idempotent SQL creates only the expense table, owner/date index, positive-amount check, and account foreign key in the new migration. Aspire confirms the API and database healthy using `/api/health`; logs confirm `CreateExpenses` applied and normal API startup. The temporary verification session was stopped after inspection.
