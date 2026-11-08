# ADR 0022: Use PRs as the pre-merge application verification gate

- Status: Accepted; authentication matrix scope refined by [ADR 0023](0023-focused-identity-upgrade-acceptance.md).
- Date: 2026-11-08
- Supersedes automatic heavy local pre-push validation from [ADR 0018](0018-coverage-regression-gate.md), and push/CI event selection from [ADR 0021](0021-docs-markdown-check-exclusion.md). Pre-commit protections, exact coverage comparisons, and full application suites remain.

## Context

Running application builds/tests/coverage locally before push and then on both feature-push and pull-request events repeats expensive work. The screenshot reviewed with the owner showed two complete Verify runs for the same development update. The owner agreed to keep inexpensive push hygiene, make PR CI the pre-merge application gate, and retain full validation of actual main revisions.

## Decision

- Local pre-commit retains secret/whitespace/conflict checks and relevant frontend lint/C# whitespace formatting.
- Every local pre-push, regardless of paths or branch, validates supplied refs, scans exact pushed revisions/history for secrets, and checks their maintained-file whitespace/conflict markers. Redacted scanning precedes potentially raw whitespace diagnostics. No build/test/coverage/Docker/baseline fetch runs automatically there; deleted refs are ignored and repeated targets deduplicated.
- GitHub feature-branch push runs hygiene only. A PR opened/reopened/updated runs full application validation unless its complete base/head three-dot diff is confined to lowercase `docs/**/*.md`.
- Every main push runs full validation, including docs-only merges. Tags/unknown events conservatively request full work.
- Verify always starts; hygiene always runs. Expensive jobs consume the hygiene scope output. Docs-only PRs retain both existing authentication matrix contexts through success notices, while feature pushes skip those matrix runners entirely. No whole-workflow path filter or hosted branch-rule change is introduced.
- Explicit manual backend/frontend/coverage commands remain available. Full PR/main validation retains backend/frontend/E2E suites, Docker-backed API tests, and exact per-module line/branch coverage comparisons.

## Consequences and alternatives

Pushing progress no longer requires Docker, a baseline fetch, or application compilation. Hygiene still needs the pinned scanner, Git and Node. Faulty application code may reach a feature branch before CI reports it; the full PR suite is the intended shared gate before merge. This does not replace test-first implementation or required behavior/visual checks.

PR workflows normally test a proposed merge candidate and rerun when the head changes; main workflows verify the actual resulting revision. The main run adds post-merge cost intentionally. A docs-only main push remains full validation even though its PR may have been hygiene-only.

Running full checks on feature pushes remains reasonable for repositories needing feedback before PR creation, but offers little extra value in PocketLedger's PR-based workflow. Keeping full local pre-push coverage was rejected as an expensive default; developers can request the same checks explicitly.

Regression cases first reproduced heavy source/tooling/multi-ref pushes, an unnecessarily heavy feature-push event, and source-deletion build selection. Updated tests then passed with hygiene-only push execution. Tests also verify full main events, full mixed PR diffs, docs-only PR behavior, malformed/missing objects, matrix gating, and retained secret/whitespace protection. See [learning note 013](../learning/013-git-hooks-and-ci.md).

## References

- [GitHub pull-request events and merge-candidate checkout](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).
- [Conditional job success semantics](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions).
