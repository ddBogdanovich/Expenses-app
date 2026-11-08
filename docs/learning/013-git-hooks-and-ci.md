# Git hooks and continuous integration

## The problem in PocketLedger

A frontend build cannot detect a C# error, and a domain test cannot detect a broken login form. Full backend/coverage/E2E checks are valuable, but running them locally and again for both push and PR events duplicates work and slows publishing progress. PocketLedger keeps inexpensive hygiene at the push boundary and uses the PR as the authoritative pre-merge application gate.

A **Git hook** is a local program Git runs before an operation. A nonzero exit code stops it. **Continuous integration (CI)** verifies committed revisions on GitHub. This policy is recorded in [ADR 0022](../decisions/0022-pr-centered-verification.md); [ADR 0012](../decisions/0012-git-hooks-and-continuous-integration.md), [ADR 0018](../decisions/0018-coverage-regression-gate.md), and [ADR 0021](../decisions/0021-docs-markdown-check-exclusion.md) retain the earlier decisions and their supersession links.

## Install once per clone

Use Node.js 24 LTS, npm, Git, and `tar`. The selected .NET SDK remains necessary for backend development and C# pre-commit formatting; Docker is necessary for full API/E2E/coverage verification, not for pre-push hygiene.

```sh
npm ci
npm run hooks:install
npm --prefix src/PocketLedger.Web ci
dotnet restore PocketLedger.slnx
```

The root npm package pins Lefthook and the frontend keeps its own lockfile. `hooks:install` downloads checksum-verified Gitleaks into ignored `.tools/` and installs hooks. It reuses the pinned version on subsequent runs. Missing hygiene tools fail with setup instructions; hooks do not silently install dependencies. Git/Node and applicable language tools must be available to GUI Git clients too.

## What runs

| Stage/event | Work |
| --- | --- |
| Local pre-commit | Staged secrets, whitespace/conflict markers, relevant frontend lint and C# whitespace formatting |
| Local pre-push, any branch/path | Redacted secrets and whitespace/conflict checks for every exact non-deleted pushed commit; no builds/tests/coverage |
| GitHub feature-branch push | Hygiene only; no duplicate application suite |
| GitHub PR opened/reopened/updated | Full backend/frontend/E2E/coverage, except docs-only PRs get hygiene and lightweight status reporting |
| GitHub push to main | Full validation of the actual merged revision, even for docs-only changes |
| Manual application/coverage command | The explicitly requested full checks |

Only lowercase `.md` files under `docs/` qualify for a docs-only PR. Root Markdown, `.mdx`, uppercase `.MD`, non-Markdown docs files, and mixed code/tooling PRs receive full PR validation. A docs-only latest commit does not turn a mixed PR into a docs-only PR. Tags/unknown CI events conservatively request full validation.

## Lightweight local push checks

Pre-push reads Git's actual ref protocol. It validates commit IDs and collects every non-deleted local target, deduplicating repeats. It checks those committed trees rather than the working tree or just the checked-out HEAD. First pushes and unavailable remote objects need no baseline or main ancestry: the full committed target is the hygiene subject either way. Multiple refs cannot hide an unchecked target; deletion-only pushes need no checks. With no protocol input, the manual runner checks HEAD.

Redacted Gitleaks scans run **before** whitespace diagnostics, because `git diff --check` prints offending lines. A line containing both a credential and trailing whitespace must be rejected/redacted before Git can echo it. Push scanning targets supplied revisions and their reachable history; manual/CI hygiene retains Gitleaks' full-ref scope. Maintained-file whitespace excludes installed third-party `.agents/skills/` sources, but secret scanning includes them.

Pre-push does not run .NET/npm builds, tests, coverage, package installation, Docker, or baseline fetches. It does not execute the dashboard test resource. Removing expensive push checks does not remove the requirement to test while implementing a feature; it moves the automatic shared gate to PR CI.

## Partial staging remains protected

Git has a working tree, index, and committed history. A partially staged file has different content in the first two. Lefthook temporarily hides unstaged portions of partially staged files, runs pre-commit, and restores them after success/failure. Checks never automatically fix or stage source. Regression tests use the real manager and verify both snapshots remain intact; unrelated unstaged files can still be visible to project-level tools.

The pre-push Lefthook script job forwards Git's protocol without filtering by the checkout's upstream. Its shell wrapper uses LF even with Windows autocrlf. Tests retain protocol, deletion, multi-ref, spaced-path, partial-staging, and secret-redaction coverage in temporary repositories.

## CI selection and check statuses

Verify always starts for push/pull_request and its hygiene job always scans secrets and committed whitespace. `node scripts/checks.mjs ci-scope` emits a `run_application_checks` job output:

- Push to `refs/heads/main`: true, regardless of changed paths.
- Push to another branch: false, regardless of changed paths.
- PR: false only if the complete base/head three-dot diff is a nonempty docs-only Markdown set; otherwise true.
- Missing PR objects or unrecognized event types: full checks; malformed PR IDs fail closed.

The PR suite normally tests GitHub's proposed merge candidate. GitHub automatically reruns it when the PR's head is updated, so a second heavy feature-push run adds little value here. The full main run validates the actual post-merge revision. See [GitHub's PR event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).

Only full-validation events install root regression dependencies and run root tests plus backend/frontend/coverage and authentication E2E. Main pushes and ordinary PRs retain the full current-realm suite. The phase1 variant is now a focused upgrade smoke selected for identity/integration changes, as recorded in [ADR 0023](../decisions/0023-focused-identity-upgrade-acceptance.md). Coverage still uses exact counters and independently built committed snapshots, with real disposable API databases.

A whole path-skipped workflow can leave required checks Pending, so there is no top-level path filter. [Conditionally skipped jobs report success](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions). Backend/frontend/coverage jobs use the hygiene output. Both authentication matrix jobs expand on docs-only PRs and report only a success notice; phase1 also reports a notice when its identity dependencies are unchanged so their existing `current`/`phase1` contexts remain available. Feature pushes skip the matrix job before expansion to avoid allocating those extra runners. Hosted required-check rules are unchanged; the PR's real application results remain the pre-merge evidence.

## Run checks deliberately

```sh
npm run hooks:check
npm test
npm run check:frontend
npm run check:backend
npm run check:hygiene
npm run coverage
npm run coverage:check
node scripts/checks.mjs pre-push < /dev/null
```

`hooks:check` uses the index and does nothing when it is empty. Root `npm test` runs tooling regressions; frontend tests remain separate. `check:backend` includes full Docker-dependent API tests and formatting. `check:hygiene` scans committed content/history, including refs outside HEAD. `coverage:check` still fetches its baseline and uses isolated source snapshots; it is no longer invoked automatically by pre-push. See [learning note 020](020-coverage-and-regression-gates.md).

Git's `--no-verify` and `LEFTHOOK=0` bypass local hooks, but CI runs independently. Branch protection is configured separately. No real commit or push is created solely to test these hooks; temporary repositories provide test history.

## Regression evidence and exercise

Before implementation, three new policy cases failed: source/tooling/new/multi-ref pushes invoked application commands; feature-push CI requested full work; and a source deletion selected builds. They passed after changing local push to hygiene-only and event selection to PR/main. The matrix policy assertion likewise failed before adding the feature-push job gate. Existing synthetic secret/whitespace, secret-before-diagnostics, off-HEAD scanning, PR full-diff, partial-staging, and coverage comparator regressions remain.

In a disposable repository, make a source commit and a docs commit, then inspect pre-push output: why should neither build the application? Compare a feature-push event with a PR containing both commits: which requests the full suite? Why should a docs-only main push still run full checks? Add a token-shaped synthetic value on another branch and verify manual hygiene still rejects it without printing it.
