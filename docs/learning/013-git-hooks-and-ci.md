# Git hooks and continuous integration

## The problem in PocketLedger

A successful frontend build cannot detect a C# compiler error, and a successful domain test cannot detect a broken login form. Running PostgreSQL containers for every tiny commit would interrupt daily work. PocketLedger therefore checks different things at different stages.

A **Git hook** is a local program Git runs before an operation. A nonzero exit code stops that operation. **Continuous integration (CI)** runs verification on a hosted runner after a push or for a pull request, using the committed revision rather than the developer's working tree. Local hooks provide early feedback; CI provides repeatable shared evidence.

## Install once per clone

Use Node.js 24 LTS, npm, the .NET SDK selected by `global.json`, Git, and `tar` (available on standard macOS/Linux and current Windows installations). Run from the repository root:

```sh
npm ci
npm run hooks:install
npm --prefix src/PocketLedger.Web ci
dotnet restore PocketLedger.slnx
```

The private root `package.json` installs Lefthook, not application dependencies. The frontend keeps its own package and lockfile. The explicit installation command works even when npm disables dependency lifecycle scripts. Gitleaks is downloaded from its official GitHub release, checked against the pinned SHA-256, and stored in ignored `.tools/`. Rerunning the command reuses the installed version. Hook configuration is read on every run; reinstall after changing hook names or upgrading tools. Git and Node/.NET must also be available to GUI clients. Hooks do not fetch missing tools at commit time.

Installation requires network access; hooks use installed tools. C# pre-commit formatting assumes the solution has been restored. Pre-push backend checks can restore dependencies and may therefore need network access if packages are missing.

## What runs

| Stage | Checks | Scope and cost |
| --- | --- | --- |
| Pre-commit | Gitleaks; Git whitespace and conflict markers; Oxlint with warnings treated as errors; C# whitespace formatting | Staged changes, usually quick. C# formatting still loads the solution. |
| Pre-push | Hook regression tests; .NET restore/build and Domain/UseCases tests; frontend lint/typecheck/build/Vitest | Relevant areas selected from the pushed refs; documentation-only changes skip builds. No Docker required. |
| GitHub Actions | Hygiene and hook regressions; full backend restore/build/test/format; full frontend installation and checks | Every push and pull request. API tests use Docker and disposable PostgreSQL. |

For example, changing `Money.cs` selects C# whitespace verification before commit and backend verification before push. Changing `RegistrationPage.test.tsx` selects frontend linting before commit and all frontend checks before push. Changing `Directory.Packages.props` selects backend verification; changing root hook scripts or `.editorconfig` selects both areas before push. Deleting a source file still selects its area's push checks. Project/linter configuration changes broaden pre-commit checks. Generated EF code follows `dotnet format`'s default generated-code handling; builds and API migration tests remain the broader verification.

Installed third-party files under `.agents/skills/` are excluded only from whitespace checks because their upstream formatting is not maintained here. Secret scanning includes those files. One pre-existing extra blank line at the end of ADR 0001 was removed to establish the maintained-file whitespace baseline.

The backend push build uses `.artifacts/hooks`, leaving a running Aspire API's assemblies alone. It does not execute the Aspire dashboard's `tests` resource. API tests remain in the full suite; there is no in-memory database substitute. Playwright MCP visual validation remains a separate development requirement for UI changes.

## Staging is a separate snapshot

Git has a working tree (files on disk), an index (the proposed commit), and committed history. With `git add -p`, one file can contain staged and unstaged edits. Checking its filename alone would normally let the linter see both.

Lefthook 2.2.2 temporarily saves and hides the unstaged portion of partially staged files, runs checks, and restores that portion. Our checks do not automatically fix or stage anything. Regression tests exercise the real manager on both passing and failing checks and compare the index and working file afterwards. Unrelated unstaged files are still visible to project-level tools, so pre-commit is not an isolated build of the index.

Pre-push uses a Lefthook script job so the manager does not filter it using the checked-out branch's upstream before our code reads the actual pushed refs. Its tiny shell wrapper delegates to the shared Node runner. `.gitattributes` keeps shell wrappers in LF format even with Windows `core.autocrlf=true`; a regression test checks this checkout behavior.

Pre-push reads every ref Git supplies. A deletion needs no build. New branches or a missing remote commit use all paths in the pushed tree, avoiding an unsafe guess about what changed. Local builds still inspect the current working tree, including unrelated edits, and do not separately check out every pushed branch. CI checks the actual pushed/PR revision. Prefer pushing the branch you are working on with a clean working tree.

## Run checks yourself

```sh
npm run hooks:check
npm test
npm run check:frontend
npm run check:backend
npm run check:hygiene
```

`hooks:check` runs the actual pre-commit hook against the current index, so it does nothing when no files are staged. `npm test` at the root runs hook regression tests; frontend behavior tests remain `npm test` inside `src/PocketLedger.Web`. `check:backend` includes Docker-dependent API tests and full formatting. `check:hygiene` checks the committed tree's whitespace and reachable history for secrets, so uncommitted changes are not included. Gitleaks output is redacted; a finding is a prompt to remove a credential and rotate it if it was real, not to paste it into a log or documentation.

To run the push checks manually against all tracked paths without pushing:

```sh
node scripts/checks.mjs pre-push < /dev/null
```

Git's `--no-verify` can bypass commit/push hooks, and `LEFTHOOK=0` disables Lefthook. Use bypasses deliberately; CI still runs. The workflow file does not enable branch protection by itself. Require the `hygiene`, `backend`, and `frontend` Verify jobs in GitHub settings when you want failing CI to block merges.

## Why these tools, and what they cost

Lefthook manages installation and staging safeguards for both languages from one repository-level configuration. Husky plus lint-staged is a reasonable npm-oriented alternative; the pre-commit framework supplies reusable multilingual plugins at the cost of Python tooling. Plain hooks require maintaining those safeguards ourselves. We retain Oxlint and .NET's existing analyzers rather than adding competing linters. Gitleaks adds a pinned native executable to install and update. See [ADR 0012](../decisions/0012-git-hooks-and-continuous-integration.md).

## Exercise

In a disposable branch or clone, stage a harmless TypeScript edit, make another unstaged edit in the same file, then run `npm run hooks:check`. Compare `git diff` and `git diff --cached` before and after. Repeat with a staged lint error. Why should automatic `git add` be avoided here? Which check would catch a type error that Oxlint does not catch? Why does a passed local push check not prove that another pushed branch's committed revision is correct?
