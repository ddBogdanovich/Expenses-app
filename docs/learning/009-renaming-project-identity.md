# Learning note 009: Renaming a solution without losing its state

## Names participate in contracts

PocketLedger is the product name and .NET namespace prefix. `PocketLedger.slnx` includes the backend, AppHost, and test projects. For example, `src/PocketLedger.Api/PocketLedger.Api.csproj` references the renamed Infrastructure, UseCases, and ServiceDefaults projects. The SDK derives assembly and default namespace names from project filenames, so changing only the solution filename would leave the implementation inconsistent.

Aspire generates `Projects.PocketLedger_Api` from the referenced API project. The API's `InternalsVisibleTo` entry must use `PocketLedger.Api.Tests` for WebApplicationFactory to retain access to the entry point. The npm package, lockfile, browser title, and placeholder heading use PocketLedger too. Existing local IDE solution metadata was renamed without resetting preferences.

## Code identity and stored data differ

EF's snapshot and migration designers contain fully qualified CLR entity names. Those names are updated together with the domain namespaces. Migration IDs and SQL table names are retained: an assembly rename should not recreate UserAccounts or Expenses. `dotnet ef migrations has-pending-model-changes --project src/PocketLedger.Infrastructure --no-build` checks that the renamed runtime model and snapshot still agree.

The AppHost UserSecretsId is a stable identifier for saved development secrets, rather than a display name. Keeping it preserves the signing key and PostgreSQL credentials. Never copy secret values into source code or print them while checking a rename.

Aspire's generated volume names can depend on application identity. The AppHost now explicitly names its volume `pocketledger-postgres-data`. The previous stopped volume was copied, mounted read-only at the source, and compared against the target before starting the renamed app. The original was retained. This preserves the database while moving to a predictable name; starting a fresh empty volume would not prove continuity of existing data.

JWT issuer and audience are externally meaningful strings, unlike C# namespaces. Their defaults are now `PocketLedger` and `PocketLedger.Web`, so old tokens using former defaults require signing in again. Existing accounts and password hashes stay valid. A compatibility period accepting both issuers is an alternative for a live deployment, but is unnecessary for this local learning milestone.

## Verification

Restore and build the renamed solution, run its existing behavior tests, and verify formatting using the commands in AGENTS.md. For the frontend, use `npm ci`, `npm run build`, and `npm run lint` from `src/PocketLedger.Web`. Inspect for leftover old names in maintained source and configuration, check documentation links, and use Aspire to confirm database, API, and frontend readiness. Stop the verification session afterward.

No new behavior tests are necessary for a mechanical rename: the existing authentication, ownership, persistence, and domain tests should keep passing. The outer checkout folder is retained to preserve its registered workspace location; developers may store the repository in any folder.

## Questions

1. Why can changing a .csproj filename break an Aspire generated type or test-host discovery?
2. Why should migration IDs remain stable when namespaces change?
3. Which identifiers are safe to rename freely, and which can disconnect saved state?
4. How would you handle old JWT issuers if this were already serving deployed clients?

See [ADR 0008](../decisions/0008-pocketledger-project-identity.md) for the decision and tradeoffs.

## Recorded checks

The renamed solution restores and builds with zero warnings/errors. All 83 tests pass under the new assembly names: 20 domain, 3 shared Result, and 60 PostgreSQL-backed API/calendar tests. Formatting, frontend build and lint, EF model/snapshot consistency, and local documentation links pass. A comparison with the original source confirms that production changes beyond naming are limited to the explicit local volume name. The npm lockfile preserves dependency versions and integrity entries; npm reports an existing high-severity Vite advisory, which is outside the naming change.

Aspire confirmed the API, expenses database, and frontend healthy. API logs show that the existing schema was already up to date, and the running database container was verified to mount `pocketledger-postgres-data`. Verification encountered offloaded iCloud runtime files and an incomplete npm cache; regenerating build outputs and retrying the frontend installer from a clean cache resolved these environment issues without source or dependency changes. The temporary Aspire session was stopped after verification.
