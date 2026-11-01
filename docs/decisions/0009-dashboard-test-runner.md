# ADR 0009: On-demand backend tests in the Aspire dashboard

- Status: Accepted
- Date: 2026-11-01

## Context

The owner wants to operate the API and frontend from Aspire and run the existing backend tests by clicking a dashboard control. Test runs must not start on every application launch or replace assemblies used by the running API.

## Decision

Retain the API and Vite resources and their built-in dashboard lifecycle controls. Add a local `tests` executable resource using Aspire's AddExecutable and WithExplicitStart APIs. It invokes `dotnet test PocketLedger.slnx --artifacts-path <repository>/.artifacts/tests --logger "console;verbosity=normal"` from the repository root. The process builds the current source, runs the existing xUnit v2 suites, and streams output and its exit code to the dashboard. No wrapper script, custom process supervisor, new test framework, or extra hosting package is needed.

The resource is declared only in run mode, so it does not become a deployment workload. WithExplicitStart makes it visible but inactive at startup. Built-in Start and Restart actions initiate subsequent runs; Stop cancels the process. Native lifecycle state prevents a second Start while the resource is running. Test builds use an isolated artifacts directory, ignored by Git, to avoid replacing or locking the development API's output files.

The runner has no reference to the development database and no dependency on API or frontend readiness. The PostgreSQL integration tests continue creating disposable Testcontainers databases with production migrations and test-only keys. Docker remains required for the full suite. No frontend behavior test suite exists for the static placeholder.

## Consequences and alternatives

A resource makes progress and console output visible and reuses Aspire's lifecycle controls. It ends with exit code zero on success and nonzero on failure; successful completion is an exited job rather than a continuously healthy service. The first run restores and builds into its own directory and may be slower. Completed tests can be started again from the dashboard.

A custom dashboard command could label its action Run tests, but would need additional process-launch, logging, cancellation, and repeated-run handling. A dedicated runner project would add a project that only wraps the existing CLI. Reusing normal API build outputs would be simpler but risks file locks and races during development, especially on Windows. Isolated artifacts keep this developer tool independent from the running services.
