# ADR 0011. Serve today’s spending as an authenticated read projection

- Status: Accepted
- Date: 2026-11-02

## Context

The main page needs one account’s total for the current Warsaw day. The existing expense list returns every matching purchase field across that account’s history.

## Decision

Provide `GET /api/expenses/today` as a vertical slice. The handler derives the owner from the validated identity, obtains today from the existing business calendar and asks Infrastructure for the sum. Return the purchase date and total integer grosz as decimal digits in a JSON string. This preserves the precision of a PostgreSQL sum in a JavaScript client. Both allowance classifications count.

Extend the in-memory session from [ADR 0010](0010-registration-frontend-api-connection.md) to login and the main page. Use the existing same-origin proxy and require bearer authentication on the read endpoint.

## Consequences

The page makes a single small read regardless of account history. The projection uses a parameterized SQL aggregate over the existing columns and index. Its schema dependency is covered by a PostgreSQL integration test. This avoids transferring historical expense details or maintaining a second balance that must be updated when expenses are edited. Clients must parse the total as integer digits. A page reload requires a fresh login.
