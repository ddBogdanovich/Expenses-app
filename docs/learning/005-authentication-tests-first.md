# Authentication: the red step of TDD

Historical red milestone: Feature 1 started with executable HTTP acceptance criteria, before authentication was implemented. TDD means red (a test fails for missing behavior), green (implement that behavior), then refactor while preserving behavior.

`tests/PolandExpenses.Api.Tests/AuthenticationTests.cs` starts the actual API with `WebApplicationFactory<Program>` and sends JSON HTTP requests. It does not mock handlers or create pretend authentication endpoints. The suite now uses Testcontainers PostgreSQL and real migrations; an API restart scenario proves persistence across hosts. It remains API integration coverage rather than browser automation.

## HTTP contract (now implemented)

These details made the initial request executable and are now the implemented API contract.

| Request | Expected response |
| --- | --- |
| `POST /auth/register` with `{ "email": "...", "password": "..." }` | 201 with `{ "accessToken": "<JWT>" }` |
| `POST /auth/login` with the same fields | 200 with the same response shape |
| Unknown email or incorrect password on login | 401 without an access token |
| Duplicate registration | 409 without an access token; original credentials still work |
| Malformed email, empty or null required fields | 400 without an access token |

Registration creates an account; login looks it up. The screenshot's final clarification distinguishes these behaviors. Login with an unknown email must fail, and subsequent registration must succeed. A second HTTP client can log in after registration, so the behavior cannot depend on a registration client's cookies. Each scenario uses a fresh API host and unique email where it creates an account.

A JWT is a signed token carrying claims. Tests check three segments, a declared algorithm other than `none`, a subject, and future expiration. Parsing these claims does **not** verify the signature or prove that protected routes validate it. Implementation added `/auth/me` and tests for valid, expired, incorrectly signed, wrong-issuer, and wrong-audience tokens. See [Learning note 006](006-account-authentication.md) for the current implementation and limits.

## Run and interpret

```shell
dotnet test tests/PolandExpenses.Api.Tests/PolandExpenses.Api.Tests.csproj
```

At the original red milestone the API had no `/auth` endpoints: these tests compiled and failed with HTTP 404 versus the required statuses. Do not skip them or add stub endpoints just to turn them green. Existing domain and use-case tests should remain green.

WebApplicationFactory runs HTTP inside the test process, which is faster and easier to isolate than a live Aspire deployment. The cost is that it does not exercise real sockets, container orchestration, or the browser. The implementation now supplies an isolated PostgreSQL test database and verifies login across fresh hosts; do not use the developer's expenses database or substitute an in-memory repository as proof of persistence.

Exercise: implement registration first, then make login pass without creating accounts. Which test would catch accidentally implementing login as registration? Which extra test would prove that credentials survive an API restart?

Reference: [ASP.NET Core integration testing](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-10.0).

## Historical verification of the red milestone

At that stage, the API test project built with zero warnings/errors. All 15 new cases failed at missing routes; a registration run confirms expected 201 versus actual 404. Existing tests pass (6 domain, 3 use-case). `dotnet format PolandExpenses.slnx --no-restore --verify-no-changes` succeeds, with a workspace-loading warning.

At that stage, solution-wide restore was blocked by NU1902 in the existing AppHost dependency graph (`MessagePack` 2.5.302, advisory GHSA-qhrr-8q5h-9q3h). Full solution build/test verification was therefore incomplete; no dependency-audit setting was weakened. API and existing test projects were verified separately.

The green implementation now passes these tests using real PostgreSQL. The AppHost MessagePack dependency is pinned to patched 2.5.303, resolving the earlier restore blocker without weakening audit settings.
