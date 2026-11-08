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

Installation requires network access; hooks use installed tools. C# pre-commit formatting assumes the solution has been restored. Pre-push coverage fetches fresh main and installs locked dependencies in temporary source snapshots, requiring network access. Relevant backend pushes now require Docker for full API coverage; see [ADR 0018](../decisions/0018-coverage-regression-gate.md).

## What runs

| Stage | Checks | Scope and cost |
| --- | --- | --- |
| Pre-commit | Gitleaks; Git whitespace and conflict markers; relevant frontend/C# checks | Docs-only Markdown keeps hygiene and does not load language tooling. |
| Pre-push | Docs-only: exact committed-tree whitespace/conflict checks and reachable-history secrets. Other changes: existing relevant builds/tests/coverage | Proven new docs branches also use the lightweight path. Unknown/mixed branches retain normal selection; backend coverage requires Docker. |
| GitHub Actions | Hygiene always; application tests/builds/coverage only for non-docs-only event changes | Workflow and required-check names remain present. API tests use disposable PostgreSQL when application checks run. |

For example, changing `Money.cs` selects C# whitespace verification before commit and backend verification before push. Changing `RegistrationPage.test.tsx` selects frontend linting before commit and all frontend checks before push. Changing `Directory.Packages.props` selects backend verification; changing root hook scripts or `.editorconfig` selects both areas before push. Deleting a source file still selects its area's push checks. Project/linter configuration changes broaden pre-commit checks. Generated EF code follows `dotnet format`'s default generated-code handling; builds and API migration tests remain the broader verification.

Installed third-party files under `.agents/skills/` are excluded only from whitespace checks because their upstream formatting is not maintained here. Secret scanning includes those files. One pre-existing extra blank line at the end of ADR 0001 was removed to establish the maintained-file whitespace baseline.

The backend push build uses `.artifacts/hooks`, leaving a running Aspire API's assemblies alone. It does not execute the Aspire dashboard's `tests` resource. The coverage gate additionally runs full backend suites in independent committed snapshots; there is no in-memory database substitute. Playwright MCP visual validation remains a separate development requirement for UI changes.

## Staging is a separate snapshot

Git has a working tree (files on disk), an index (the proposed commit), and committed history. With `git add -p`, one file can contain staged and unstaged edits. Checking its filename alone would normally let the linter see both.

Lefthook 2.2.2 temporarily saves and hides the unstaged portion of partially staged files, runs checks, and restores that portion. Our checks do not automatically fix or stage anything. Regression tests exercise the real manager on both passing and failing checks and compare the index and working file afterwards. Unrelated unstaged files are still visible to project-level tools, so pre-commit is not an isolated build of the index.

Pre-push uses a Lefthook script job so the manager does not filter it using the checked-out branch's upstream before our code reads the actual pushed refs. Its tiny shell wrapper delegates to the shared Node runner. `.gitattributes` keeps shell wrappers in LF format even with Windows `core.autocrlf=true`; a regression test checks this checkout behavior.

Pre-push reads every ref Git supplies. A deletion needs no build. For a new branch, a locally known `origin/main` merge base can prove that only `docs/**/*.md` changed; that branch uses hygiene-only checks on its first push too. If the comparison includes anything else, or no usable main ancestry exists, all paths in the pushed tree remain the conservative fallback. A nonzero but unavailable remote commit also retains that fallback. Multiple pushed refs are combined, so a docs-only ref cannot exempt a simultaneous source push. Local builds still inspect the current working tree, including unrelated edits. The coverage gate separately archives and tests every relevant exact pushed commit; docs-only hygiene separately checks the actual pushed revisions, not merely the checked-out HEAD.

## Documentation-only fast path

The owner selected a lightweight policy for Markdown under `docs/`, recorded in [ADR 0021](../decisions/0021-docs-markdown-check-exclusion.md). A nonempty staged/pushed path set must consist entirely of lowercase `.md` paths inside that directory. Additions, edits, deletions, and moves within docs qualify. Rename detection is disabled so moving source into docs or docs into source exposes both paths and cannot inherit the fast path.

Pre-commit still scans staged secrets and rejects introduced whitespace/conflict markers; it then returns before language tooling. Docs-only pre-push runs redacted Gitleaks on the pushed revisions' reachable history before checking each exact pushed tree's maintained-file whitespace/conflict markers. The order matters: Git whitespace diagnostics print offending lines, so secrets must be rejected before those diagnostics can echo them. Manual/CI hygiene uses the same ordering. A missing scanner fails with setup instructions, including for docs. The scanner's log options contain validated commit IDs, so pushing another branch cannot accidentally scan only the current checkout. No application build/test/coverage command runs on this path.

| Changed paths | Local behavior | GitHub push/PR behavior |
| --- | --- | --- |
| `docs/prd-example.md` and `docs/learning/example.md` | Secret and whitespace/conflict checks only when the relevant diff is known | Hygiene and lightweight status checks; no application validation |
| `docs/example.md` plus `src/PocketLedger.Domain/Money.cs` | Normal source/mixed checks | Full workflow |
| `docs/example.md` plus `README.md` | Normal pre-commit hygiene; normal area selection on push | Full workflow |
| `docs/diagram.svg`, `docs/example.mdx`, or `docs/example.MD` | Normal checks | Full workflow |
| New docs branch with unknown main ancestry | Conservative full-tree selection | CI likewise selects full checks if scope cannot be established |

Mixed commits retain hygiene over the whole staged change, including docs. Explicit manual hygiene/coverage commands also retain their full scope. No permanent scanner allowlist is introduced.

Verify always starts for pushes and pull requests. After checkout with full history, `node scripts/checks.mjs ci-scope` emits a `run_application_checks` job output. Existing branch pushes use exact before/after IDs; new branches use the conservative selection above. PRs use the complete base/head three-dot diff. Missing objects select full work, malformed events fail, and tags/unknown events conservatively use full checks. No GitHub API file-list truncation or top-level `paths-ignore` is involved. A docs-only push on a mixed code PR can use light push checks while that PR still receives full validation.

The hygiene job always installs the pinned scanner and runs committed-tree/full-history hygiene, preserving Gitleaks' default scan across all Git refs available in that checkout. Docs-only pre-push instead targets the supplied pushed commit IDs. Only non-docs-only events install root test dependencies and run root regressions, then the backend/frontend/coverage jobs. GitHub documents that [conditionally skipped jobs report success](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions). To retain both existing E2E matrix check names explicitly, `current` and `phase1` jobs still expand on docs-only events but run only a success notice; checkout/setup/install/build/test steps are conditional. This small runner cost avoids disappearing matrix contexts or a whole workflow left pending. Hosted branch protection is unchanged.

Regression evidence: five revised/new cases failed against the initial broad exemption and passed after narrowing it. They prove first-push hygiene without application commands, staged/committed rejection of synthetic secrets and whitespace, preserved index/worktree, exact push versus full PR scope, conservative fallbacks, and workflow/matrix gating. Independent review added a combined secret-plus-whitespace case; both docs-only push and manual/CI tests first reproduced raw-line disclosure, then passed after scanning was moved before whitespace diagnostics. A further off-HEAD branch-secret regression failed when manual hygiene was accidentally restricted to HEAD, then passed after its original all-ref scope was restored. Existing deletion, rename-boundary, partial-staging, and mixed-ref tests remain. One test helper initially failed to recognize digits in `authentication-e2e`; its parser was corrected without relaxing policy assertions. Temporary repositories provide Git history; no real commit/push is created solely to test hooks.

## Run checks yourself

```sh
npm run hooks:check
npm test
npm run check:frontend
npm run check:backend
npm run check:hygiene
npm run coverage
npm run coverage:check
```

`hooks:check` runs the actual pre-commit hook against the current index, so it does nothing when no files are staged. `npm test` at the root runs hook regression tests; frontend behavior tests remain `npm test` inside `src/PocketLedger.Web`. `check:backend` includes Docker-dependent API tests and full formatting. `check:hygiene` checks the committed tree's whitespace and reachable history for secrets, so uncommitted changes are not included. Gitleaks output is redacted; a finding is a prompt to remove a credential and rotate it if it was real, not to paste it into a log or documentation.

To run the push checks manually against all tracked paths without pushing:

```sh
node scripts/checks.mjs pre-push < /dev/null
```

Git's `--no-verify` can bypass commit/push hooks, and `LEFTHOOK=0` disables Lefthook. Use bypasses deliberately; CI selection is independent and always keeps hygiene. The workflow does not enable branch protection, but retains existing job/matrix check names so required statuses can complete on docs-only events.

## Why these tools, and what they cost

Lefthook manages installation and staging safeguards for both languages from one repository-level configuration. Husky plus lint-staged is a reasonable npm-oriented alternative; the pre-commit framework supplies reusable multilingual plugins at the cost of Python tooling. Plain hooks require maintaining those safeguards ourselves. We retain Oxlint and .NET's existing analyzers rather than adding competing linters. Gitleaks adds a pinned native executable to install and update. See [ADR 0012](../decisions/0012-git-hooks-and-continuous-integration.md).

## Exercise

In a disposable branch or clone, stage a harmless TypeScript edit, make another unstaged edit in the same file, then run `npm run hooks:check`. Compare the index and working tree before and after; repeat with a staged lint error. Then stage only `docs/example.md`, first clean and then with trailing whitespace, followed by a mixed docs/source change. Which protections still apply to docs? Why must a move from source into docs expose the old path too? Why can a docs-only push and a mixed PR require different scopes?

## Coverage supplement

[Learning note 020](020-coverage-and-regression-gates.md) describes Coverlet/ReportGenerator/V8 reports and the stricter push policy introduced after this original tooling milestone. There is no native Git hook for creating a PR; pre-push is the local gate. Coverage reports survive failed comparisons, while temporary source/dependency trees are removed. Two measured revisions cost more than the original Docker-free push check; behavior/E2E/visual tests remain necessary.
