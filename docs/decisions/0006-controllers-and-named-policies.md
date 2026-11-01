# ADR 0006: Controllers within vertical slices and named policy values

- Status: Accepted; route paths superseded by [ADR 0007](0007-expense-aggregate-and-api-prefix.md).
- Date: 2026-11-01
- Supersedes the `IEndpoint` / minimal API mechanism in [ADR 0002](0002-clean-domain-with-vertical-use-cases.md) and [ADR 0005](0005-account-authentication.md). All other DDD and module boundaries remain in effect.

## Context

The owner prefers controller-based HTTP APIs while retaining vertical slices and a modular monolith. The owner also requires business rules such as the password minimum to have meaningful names instead of unexplained numeric literals.

## Decision

Place one thin `[ApiController]` inside each feature folder alongside its concrete handler. Controllers use attribute routes and constructor injection, return MVC action results, and map expected handler `Result` failures to Problem Details. The API host maps controllers; UseCases registers its assembly as an explicit MVC application part and continues controlled scanning of `IUseCaseHandler` implementations. Remove `IEndpoint` and its singleton endpoint discovery. Framework health/telemetry mappings remain shared host infrastructure.

Preserve the existing `/auth/register`, `/auth/login`, and `/auth/me` routes, statuses, JSON names, authorization requirements, and handler behavior. MVC handles JSON binding and malformed-body 400 responses. Keep application validation in handlers so non-HTTP callers still receive the same expected business outcomes. Do not relocate slices into a global Controllers directory or add mediator dispatch.

Define fixed numeric rules using named constants or typed policy values in their owning layer. `PasswordPolicy.MinimumLength` and `MaximumLength` own credential limits and are reused by error messages. Domain owns email length and the PLN conversion factor; Infrastructure owns hash-storage length and JWT security/lifetime values; AppHost owns generated-key length. Reuse an existing definition only when it represents the same rule. Environment-dependent values belong in validated configuration. Avoid a global constants bucket. Generated schema history and explicit test examples retain independent literals.

## Consequences

MVC adds framework conventions, action discovery, model binding, and action results, while keeping each feature discoverable in one folder. Controllers remain HTTP adapters; domain aggregates and repository contracts retain their existing dependencies. More attributes and MVC setup replace the smaller minimal API endpoint modules, reflecting the owner's preference.

Named policies make intent visible and reduce inconsistent validation/error text without adding runtime configurability that is not needed. This is a repository-wide authoring and review rule recorded in AGENTS.md. It is deliberately not a blanket analyzer ban on every numeral: zeros, generated migrations, version identifiers, and independent boundary-test cases have useful literal meanings.
