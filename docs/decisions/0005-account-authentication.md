# ADR 0005: Account authentication within the modular monolith

- Status: Accepted; HTTP endpoint mechanism superseded by [ADR 0006](0006-controllers-and-named-policies.md).
- Date: 2026-11-01
- Supersedes the independent-database and empty-context phase of [ADR 0004](0004-postgresql-and-ef-core.md); retains PostgreSQL, EF Core, and the session data volume.

## Context

Feature 1 requires email/password registration that creates an account, login that looks it up, and JWT responses from both. The owner explicitly retains the DDD approach. Tests initially specified the HTTP contract without an implementation.

## Decision

Introduce an Accounts supporting domain in the existing projects, without adding services or projects. `UserAccount` is a small aggregate with a stable GUID, normalized `EmailAddress` value object, and opaque password verifier. Domain has no EF, web, Identity, or JWT references. Account identity is case-insensitive; normalization trims and uppercases the email.

Registration and login remain separate vertical slices using concrete handlers, `IUseCaseHandler`, stateless `IEndpoint` modules, explicit mapping, and expected `Result` errors. The account-specific repository contract lives beside its aggregate. Login loads an account for credential verification rather than a UI read projection, so it uses that repository. Password hashing and token issuance ports live with the application feature.

Infrastructure implements these ports using ASP.NET Core Identity's versioned salted password hasher and HS256 JWTs with 30-minute lifetime. Validation requires signature, expiration, issuer, audience, and HS256. Unknown accounts incur dummy password verification and return the same failure as incorrect passwords. Registration accepts 12–128 characters; login does not apply a new minimum to existing credentials. No secrets or hashes appear in response DTOs.

The repository uses EF Core/Npgsql. A PostgreSQL unique index arbitrates duplicate emails atomically, including races; only that constraint violation becomes an expected conflict. Other database failures remain exceptions. No generic repository or mediator is added.

The API now consumes `expenses` through Aspire `WithReference` and `WaitFor`. A generated 64-character secret parameter persists in AppHost user secrets and is injected into the API. Outside Aspire, supply the database connection and a random signing key of at least 32 bytes. Invalid or missing key configuration fails startup. Do not generate an ephemeral fallback key in the API.

Versioned migrations run automatically only in Development and Testing. Other environments apply reviewed SQL separately. A design-time factory enables schema generation without real secrets. API tests use disposable PostgreSQL through Testcontainers, real migrations, no repository mocks, and shared test-only key material; they cover cross-host persistence and bearer validation via `/auth/me`.

## Alternatives and costs

A managed OpenID Connect provider would outsource credential lifecycle and is preferable when external clients, federation, or broader deployment needs arise. Full ASP.NET Core Identity would supply recovery, lockout, and account management but adds a larger persistence model than this learning slice needs. A dedicated identity service adds operational cost without a current scaling requirement. This deliberately scoped first-party learning module is not an OAuth/OIDC authorization server.

Self-issued tokens require key management and ownership of credential defenses. Refresh tokens, logout/revocation, recovery, email verification, MFA, rate limiting/lockout, and budget ownership policies remain separate milestones. The browser UI still has no authentication flow or token storage policy. Tokens contain only subject and token ID plus issuer/audience/time claims. Password hashes require no domain crypto behavior; rehash-on-login can be added through an explicit aggregate behavior later.

Testcontainers adds Docker to API test prerequisites but validates the actual provider, constraints, migrations, and persistence. In-memory or SQLite substitutes would not establish PostgreSQL correctness. Startup migrations are convenient locally but unsuitable as an uncoordinated production schema rollout.

The AppHost explicitly pins transitive MessagePack to patched 2.5.303 so audit warnings do not block verification. The patch pin should be removed when an upstream integration supplies that or a later compatible fixed version.
