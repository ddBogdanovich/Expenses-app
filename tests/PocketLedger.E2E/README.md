# Authentication acceptance tests

Run from the repository root with Docker, the selected .NET SDK, and Node/npm available:

```sh
npm --prefix src/PocketLedger.Web ci
npm --prefix tests/PocketLedger.E2E ci
npx --prefix tests/PocketLedger.E2E playwright install chromium
npm run build:keycloak-theme
npm --prefix tests/PocketLedger.E2E test
```

The harness owns disposable application PostgreSQL, identity PostgreSQL, and Keycloak containers, plus API and Vite processes on per-run ports. The frontend is copied to a test-owned directory with independently installed dependencies so Aspire’s developer install cannot remove files underneath the test server. Cleanup terminates the owned process groups, including npm/dotnet children. It imports the committed realm template with random test credentials and the packaged theme. No developer database, volume, key, or user is used. Application logs/keys stay under ignored `.artifacts/e2e`; browser test output stays under ignored `output/playwright/e2e`. Credential-step traces, screenshots, and video are disabled.

A token-protected loopback-only control endpoint belongs to the harness, not the product. The browser test uses it to stop/restart the API, then checks the same local identity, persistent session, and stored expense. Other coverage proves the default legacy flow, preview isolation with mixed credentials, missing/tampered authentication, CSRF rejection, exact spending, and local/provider logout including replay of a revoked cookie.

For Playwright MCP inspection, use `E2E_INSPECT=1 npm --prefix tests/PocketLedger.E2E test`. After the tests the harness retains its disposable stack until SIGINT; ignored `.artifacts/e2e/inspection.json` contains transient test credentials, URL, and owner PID. Never publish that file. SIGINT closes owned processes/containers and deletes it. This mode is for local review; CI uses normal automatic cleanup.

`test:external` is an expert-only browser runner against an already prepared disposable stack with `E2E_*` settings and the restart control endpoint. Do not point it at the developer app. No password grant is used for application login: the suite fills real Keycloak hosted pages.
