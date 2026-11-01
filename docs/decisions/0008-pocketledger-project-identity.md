# ADR 0008: PocketLedger project identity

- Status: Accepted
- Date: 2026-11-01

## Context

The owner selected PocketLedger as a general name for the budgeting application. A project rename affects more than the solution filename: assembly names, namespaces, generated Aspire project references, test-host discovery, migration model metadata, frontend package identity, and JWT defaults must agree.

## Decision

Use `PocketLedger` for the solution, .NET project/assembly/namespace prefix, project directories, generated Aspire references, frontend title, and documentation. Use `pocketledger-web` for the npm package. Update existing EF migration namespaces and entity type names in their metadata and snapshot together, retaining migration IDs, table names, constraints, and schema operations. This naming change requires no database migration.

Default JWT issuer and audience become `PocketLedger` and `PocketLedger.Web`. Existing deployment overrides remain possible. Tokens issued with the former defaults require a fresh login after the rename; signature keys and password verifiers are unchanged.

Preserve the AppHost UserSecretsId to retain generated local credentials and signing key. Give the local PostgreSQL volume an explicit name, `pocketledger-postgres-data`, so future assembly/project renames do not silently switch storage. At this rename, the stopped existing database volume was copied into this new volume and compared for identical contents before startup. The old volume was retained as a fallback. Logical database and resource names (`expenses`, `postgres`, `api`, `web`) remain domain or orchestration names, independent of branding.

## Consequences

New checkouts use the PocketLedger names consistently. Existing development data remains accessible under the new volume name without a schema rewrite. The explicit volume name identifies one local development database per Docker environment; simultaneous independent checkouts need separate volume names. Old database volumes are not automatically removed.

The registered checkout's outer directory is an environment location, not project identity. Its filesystem location is retained so editor and chat workspace bindings remain valid. Currency, Warsaw business dates, routes, dependencies, and application behavior are unchanged.
