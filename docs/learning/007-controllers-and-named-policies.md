# Learning note 007: Controllers inside vertical slices and named policies

A vertical slice groups code by what the application does. It does not require minimal APIs. Registration now lives in `Authentication/Register/RegisterController.cs` and `RegisterHandler.cs`; login has the same arrangement in its own folder. The modular monolith and DDD boundaries stay intact.

A controller is an HTTP adapter. `[ApiController]` enables binding and automatic malformed-request responses; `[Route]` and `[HttpPost]` declare the route. MVC creates the controller and injects its concrete scoped handler. `RegisterAsync` awaits the handler and maps its `Result` to an `IActionResult`. Validation, account creation, and persistence coordination stay in the handler/domain/repository path. `CurrentAccountController` uses `[Authorize]`; credential controllers use `[AllowAnonymous]`.

Controllers live in a class library, so `AddUseCases` calls `AddControllers().AddApplicationPart(...)` with the explicit UseCases assembly. `Program.cs` calls `MapControllers`. `IEndpoint`, singleton endpoint registrations, and `MapUseCaseEndpoints` are removed. Standard health endpoint mapping remains in ServiceDefaults as host infrastructure. MVC brings conventions and more attributes than minimal APIs, while matching the owner's preferred HTTP programming model. A global Controllers folder would scatter a feature again, so we keep controllers within slices.

`ResultActionExtensions.ToActionResult` maps expected failures to MVC Problem Details with the existing status and `code` extension. Routes, success JSON, and business error semantics remain the same. Malformed JSON is rejected by MVC before the handler runs; normal email/password validation still runs in handlers and works for non-HTTP callers.

## Give numbers a meaning

`request.Password.Length < PasswordPolicy.MinimumLength` explains why the comparison exists. `PasswordPolicy.MinimumLength = 12` and `MaximumLength = 128` define fixed credential policy once. The error messages use those same values, so changing a limit cannot silently leave stale guidance. The minimum applies to registration; login keeps required-input and upper-bound validation for existing accounts.

Rules belong where their meaning belongs:

| Value | Owner |
| --- | --- |
| Password limits | UseCases authentication `PasswordPolicy` |
| Supported email length | Domain `EmailAddress.MaximumLength`, reused by EF mapping |
| Grosz per PLN | Domain `Money.GroszPerZloty` |
| JWT key minimum and token lifetime | Infrastructure `JwtSettings` |
| Password-hash column length | Infrastructure account mapping |
| Generated local signing-key length | AppHost |

Do not create one project-wide constants class: it would mix unrelated rules and encourage incorrect dependency directions. A named constant is appropriate for a fixed policy; validated options are appropriate for deployment-specific settings. Numeric coincidence does not mean two features share a policy.

AGENTS.md now requires this throughout production code. Obvious structural values, package versions, and generated schema history can retain literals. Boundary tests deliberately use independent examples such as 11, 12, 128, and 129: their expected behavior should not silently move when the implementation's constant changes. Existing migrations retain their historical column sizes; naming the current EF mapping values does not change the schema.

## Exercises

1. Trace a request from `RegisterController` through `RegisterHandler` to `UserAccountRepository`. Where would you put a new account rule, and where would you put an HTTP-only concern?
2. Which tests should fail if the registration minimum changes to 14? Why should the test inputs not all be computed from the policy constant?
3. Why does using controllers not require moving domain objects into ASP.NET Core or creating a separate authentication service?

See [ADR 0006](../decisions/0006-controllers-and-named-policies.md) and [ASP.NET Core controller APIs](https://learn.microsoft.com/en-us/aspnet/core/web-api/?view=aspnetcore-10.0).

## Verification

The full solution builds with zero warnings/errors. All 43 tests pass (12 domain, 3 use-case result, 28 PostgreSQL-backed HTTP), including the unchanged authentication scenarios, independent password-boundary examples, and malformed JSON handling through MVC. Formatting and local documentation links pass. Aspire reports the API and `expenses` healthy; API logs confirm normal startup with the existing schema already up to date. The verification AppHost was stopped afterward. No schema migration or package change was needed for this refactor.
