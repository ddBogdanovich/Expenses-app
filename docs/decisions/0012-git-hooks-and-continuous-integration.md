# ADR 0012: Use Lefthook for local checks and GitHub Actions for full verification

- Status: Accepted
- Date: 2026-11-02

## Context

PocketLedger combines a .NET solution with an npm frontend nested under `src/PocketLedger.Web`. Local checks should catch common mistakes quickly without requiring Docker or a running Aspire application at each commit. Partial staging must preserve the owner's uncommitted edits. Full API tests still need real disposable PostgreSQL databases.

## Decision

Use Lefthook 2.2.2, pinned in a private root npm tooling package and lockfile, with repository-level `lefthook.yml`. Keep frontend dependencies in their existing package. Install hooks explicitly with `npm run hooks:install`; this also installs Gitleaks 8.30.1 into ignored `.tools/` from an official release whose archive SHA-256 is pinned in `scripts/tool-versions.json`.

Pre-commit runs staged Gitleaks scanning, Git whitespace/conflict-marker checks, changed frontend source linting with Oxlint, and changed C# whitespace verification with `dotnet format whitespace`. Relevant project/linter configuration changes broaden formatting or lint checks. Checks do not fix or stage source files. Lefthook temporarily hides unstaged portions of partially staged files and restores them after success or failure; unrelated unstaged files remain visible to project-level tools. Whitespace checks exclude installed third-party `.agents/skills/` sources; secret scanning has no such exclusion.

Pre-push selects backend and frontend checks from Git's actual input refs. It uses a script job to avoid command-job filtering based on the checked-out branch's upstream, and `.gitattributes` enforces LF for its shell wrapper on Windows. It handles new branches, deletions, missing remote objects, filenames containing spaces, and multiple refs. New branches and unknown remote objects conservatively select all files in the pushed tree. The checks run against the current working tree, so CI remains the authority for each committed revision. Local backend checks restore/build into `.artifacts/hooks` and run only the Docker-free Domain and UseCases suites. Frontend checks run Oxlint, TypeScript, the Vite build, and Vitest. Changes to shared tooling select both areas; documentation-only changes skip builds.

GitHub Actions runs on pushes and pull requests with read-only repository permissions. Separate jobs verify maintained-file whitespace and reachable Git history for secrets, the full backend restore/build/test/format sequence, and the complete frontend checks after `npm ci`. The hygiene job also runs the hook regression tests. Backend integration tests use the runner's Docker daemon and their existing disposable Testcontainers databases. CI does not start Aspire or receive development database credentials/signing keys. UI changes still require the repository's Playwright MCP visual review during development.

## Consequences and alternatives

This adds a root tooling package, a native hook manager, a downloaded secret scanner, and small Node scripts to maintain. Fresh clones require the documented setup. Hooks run without downloading tools; missing tools fail with setup instructions. Network access is needed during installation and dependency restore. Node and .NET must be available in Git clients' environment as well as the terminal.

Local hooks can be bypassed. Repository administrators can require the three Verify jobs through GitHub branch protection; this change adds the workflow file without changing hosted repository settings. No commit-message policy or new frontend formatter is introduced.

Husky plus lint-staged would also work, but adds two tools and nested npm setup for repository-wide checks. The Python-based pre-commit framework supplies a broad plugin ecosystem but adds another runtime. Plain Git hooks avoid a manager dependency while requiring custom installation and staging safeguards. Lefthook supplies these capabilities in one configuration; its real partial-staging behavior is covered by regression tests.
