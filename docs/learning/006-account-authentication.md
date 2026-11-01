# Learning note 006: DDD account authentication

A bounded context is a boundary within which words and rules have a specific meaning. Here an account is an identity used to sign in, not a budget plan. Keeping authentication under `Accounts` and `Authentication` prevents password or token concerns from leaking into allowance calculations. We use folders within the existing modular monolith; separate services would add networking and deployment work without improving this boundary yet.

An aggregate is a consistency boundary with one identity and controlled creation or mutation. `UserAccount.Register` creates a new stable ID and requires a valid `EmailAddress` plus a nonempty opaque password verifier. Private setters protect that state. `EmailAddress.TryCreate` validates input and produces a value object whose equality uses the normalized value. Expected malformed input becomes a 400 `Result` in the handler, not a domain exception. Guard exceptions in the aggregate protect against programmer misuse after validation.

Email uniqueness spans aggregates, so the account alone cannot enforce it. `IUserAccountRepository.TryAddAsync` delegates atomic insertion to PostgreSQL's unique email index. Two concurrent requests can both attempt registration: one commits and the other becomes a 409 conflict. A preliminary lookup alone would race. The HTTP concurrency test demonstrates the database guarantee.

## Follow one registration

1. `UseCases/Authentication/Register/RegisterController` receives JSON through MVC and resolves its scoped concrete handler through constructor injection. The controller is created for the request.
2. `RegisterHandler` validates the email and 12–128-character password policy, asks `IPasswordService` for a hash, and creates the aggregate.
3. `UserAccountRepository` inserts through a scoped `ExpensesDbContext`. EF converts the email value object to a string; PostgreSQL enforces uniqueness. Only the specific email unique-constraint failure becomes a conflict.
4. After persistence succeeds, `IAccessTokenIssuer` issues a signed token and the controller returns only `accessToken` with 201.

Login retrieves the aggregate, verifies the hash, and issues a token with the same subject. It never calls insertion. A dummy hash gives unknown emails verification work too; the response does not reveal whether the email or password was wrong. This reduces one enumeration signal but does not promise identical timing.

Ports are application/domain interfaces; adapters are Infrastructure implementations. This lets handlers describe intent without knowing Npgsql, Identity, or JWT types. The cost is several small contracts and mappings. An ordinary CRUD service with direct EF calls would be shorter, but would couple our learning domain to persistence. We intentionally avoid generic repositories, mediator dispatch, domain-event machinery, and extra projects until behavior needs them.

Password limits now live in `Authentication/Common/PasswordPolicy`; validation and error text use the same named values. See [Learning note 007](007-controllers-and-named-policies.md) for the controller migration and repository-wide numeric-literal convention.

## Passwords and tokens solve different problems

Identity's password hasher stores a versioned salted verifier; it does not encrypt a password for later recovery. The domain treats it as opaque. JWT signing proves that claims came from a holder of the signing key; it does not encrypt them. Our tokens carry a subject (account ID), unique token ID, issuer, audience, and time claims, without email or password data.

`GET /auth/me` requires bearer authentication and returns the validated subject. Infrastructure configures signature, HS256 algorithm, issuer, audience, and expiration checks. Parsing token JSON in a test is not signature validation; tests now send valid and invalid tokens through this protected endpoint. Tokens last 30 minutes and have zero expiry grace. UTC instants define token validity; `Europe/Warsaw` still defines budgeting dates.

Aspire generates and persists the local signing secret in user secrets and injects it with the database connection. The API fails startup for missing connection/key or an undersized key; no key is committed. A restart keeps the same local key so tokens remain valid for their lifetime. Rotation, refresh, revocation, recovery, email verification, MFA, rate limiting and lockout remain future work. This module is a scoped first-party learning implementation, not a general OAuth/OIDC provider; a managed provider is an alternative with less credential lifecycle maintenance.

## Real persistence in tests

`AuthenticationDatabase` owns a Testcontainers PostgreSQL 17 instance. Each scenario uses a fresh API host and unique account email where it creates data. All hosts in the fixture share that isolated database and test key. The API applies the same migrations as development; no test repository replaces real persistence. `AccountSurvivesApiRestartAsync` registers, disposes the first host, then logs in on another host and calls `/auth/me`. A memory dictionary would lose the account and fail this behavior.

The fixture has one narrowly scoped CA1515 suppression: xUnit v2 needs the fixture and test constructor to be public for discovery and construction. The justification lives on that type; repository-wide analyzer settings remain enabled.

The fixture disposes the container after the tests. Docker must be running. This is an API integration test, not browser automation or live Aspire deployment verification. Aspire validation separately checks resource startup, ordering, readiness, and logs.

Migrations describe schema changes, not domain rules. `CreateUserAccounts` creates the account table and unique email index. Development and Testing call `MigrateAsync`; other environments must apply reviewed migrations before serving traffic. Never use `EnsureCreated` in place of migrations. `ExpensesDbContextFactory` enables generating migration SQL without launching the API or providing real credentials.

## Exercises

- Why can't `UserAccount.Register` alone guarantee unique email across two requests?
- Trace which layer changes if we replace HS256 with an external identity provider. Which domain types should stay unchanged?
- Explain why password policy belongs to the application credential flow while money arithmetic remains in the budgeting domain.
- Design a rehash-on-login flow using an explicit aggregate behavior and repository operation; preserve the distinction between credential verification and account creation.
- Before expenses become account-owned, define the authorization rule and a test proving one account cannot access another's data. A JWT alone does not enforce ownership.

References: [ASP.NET Core JWT validation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0), [Testcontainers PostgreSQL](https://dotnet.testcontainers.org/modules/postgres/), [ADR 0005](../decisions/0005-account-authentication.md).

## Verified outcome

- Full solution restore and build passed; the build reported zero warnings and zero errors.
- All 37 tests passed: 12 domain, 3 shared use-case result, and 22 PostgreSQL-backed HTTP cases. The 15 original red cases now pass.
- Solution formatting verification and local Markdown link review passed. Migration SQL was generated and reviewed for the account table and unique email index.
- Aspire started PostgreSQL, `expenses`, the API, and the frontend. Database and frontend readiness passed immediately; the first API launch timed out before application startup. A resource-scoped restart recovered the launch, the account migration ran, and `aspire wait api` confirmed healthy status. The verification AppHost was stopped afterward; its data volume was preserved.
