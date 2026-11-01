# Learning note 010: Running the app and tests from Aspire

## Start the dashboard once

From the repository root:

```sh
cd PocketLedger.AppHost
aspire start --non-interactive
```

Open the dashboard URL printed by Aspire. Docker and Node/npm must be available to the process starting AppHost. The dashboard exists only while AppHost runs; its buttons control child resources, not AppHost itself.

The resource list contains:

| Resource | Purpose | Startup |
| --- | --- | --- |
| postgres / expenses | Development PostgreSQL server and logical database | Automatic |
| api | ASP.NET Core backend; waits for database readiness | Automatic |
| web | React placeholder served by Vite, after its npm ci installer completes | Automatic |
| tests | Restore, build, and run the backend test suites | Manual |

Use the resource's Stop, Start, and Restart controls to operate it. If api is running, its root URL has no application page: `/api/health` is the development readiness endpoint, while authentication and expense routes use `/api/auth/...` and `/api/expenses`. Open the web endpoint to see the browser frontend.

## Click to run tests

1. Find `tests` in Resources. It waits for an explicit start and does not execute at startup.
2. Click its Start action (play icon or resource actions menu).
3. Open its Console logs to watch restore, build, individual tests, and suite totals.
4. A completed successful run ends with exit code 0; an exited one-shot process is expected. A failed test or build ends with a nonzero code and its explanation in the same logs.
5. Use Start again, or Restart if that is the action offered for the completed resource, for another run. Use Stop to cancel a running test process.

The command is the same dotnet test used from a terminal. No IDE test runner or new test framework is involved. The resource exists only in local run mode, never as a published application workload.

## Why separate build outputs?

Tests build the latest saved source. Rebuilding into the API's active bin/obj folders can collide with a running process, particularly on Windows. The `--artifacts-path` option sends both test binaries and intermediates to `.artifacts/tests`, separated by project. This supports running tests while the API and frontend stay up. The first run restores packages in that output tree; later runs reuse it. The ordinary terminal verification commands still work as before.

The artifacts folder is generated output, not source, and is ignored by Git. Aspire supplies lifecycle and log handling rather than us implementing Process.Start and cancellation ourselves. A custom button or wrapper project is an alternative, but adds code without changing which tests run.

See [.NET artifacts output layout](https://learn.microsoft.com/en-us/dotnet/core/sdk/artifacts-output) and [Aspire executable resources](https://aspire.dev/app-host/executable-resources/) for the mechanisms used here.

## Isolation and troubleshooting

The API integration tests create their own disposable PostgreSQL containers. They do not connect to the development expenses database, and the tests resource receives no connection-string or signing-key reference. Tests do not need the development API, web, or database to be running. Docker is required for the PostgreSQL cases; the test process reports infrastructure failures in its logs.

The web-installer resource is an npm dependency-install step. If web fails because that installer failed, inspect the installer logs (show hidden resources if needed), correct the reported issue, rerun the installer, then start web. Keep cloud-backed checkout files available locally; cached or partially downloaded node_modules can interfere with npm ci. API readiness and frontend readiness are separate checks.

## Questions

1. Why is a completed tests process with exit code 0 different from a healthy long-running API?
2. Why does WithExplicitStart belong on tests rather than on every application resource?
3. Which collisions does --artifacts-path prevent, and which resources do Testcontainers isolate?
4. What would you inspect first if web is stopped because its installer failed?

## Verified behavior

The solution builds with zero warnings/errors and formatting passes. Aspire reports api, web, and expenses healthy. Both API and web were stopped and started using their resource actions and returned to healthy. The frontend page rendered the PocketLedger heading in the browser.

At normal AppHost startup, tests remained NotStarted with an enabled Start action. The first explicit Start restored/built under `.artifacts/tests`, ran all 83 tests (20 domain, 3 Result, 60 API/calendar), and finished with exit code 0 while the development API remained available. Start was enabled again after completion. A second Start ran all 83 successfully and again finished with exit code 0. During execution, Stop/Restart were offered and duplicate Start was unavailable. Generated artifacts stayed ignored by Git.

The embedded browser could not open the dashboard because it did not trust the local development HTTPS certificate; no certificate warning was bypassed. Dashboard resource commands, states, and console output were verified through Aspire's CLI, which invokes the same resource actions. The temporary AppHost session was stopped after verification. No new dependencies or test-framework changes were required.
