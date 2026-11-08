# ADR 0021: Keep lightweight hygiene for docs-only Markdown changes

- Status: Accepted
- Date: 2026-11-08
- Supersedes the docs-only/new-branch check selection and unconditional CI application-job policies in [ADR 0012](0012-git-hooks-and-continuous-integration.md) and [ADR 0018](0018-coverage-regression-gate.md); all other verification policies remain in effect.

## Context

First pushes of new branches selected every tracked path and ran backend/frontend/coverage checks even for documentation. The owner initially requested a complete docs-only exclusion, then agreed to retain inexpensive secret and whitespace/conflict checks while skipping application validation. Skipping the entire workflow can leave required checks pending, so the selected policy must also preserve check reporting.

## Decision

When all staged paths are lowercase `.md` files under `docs/`, pre-commit scans staged secrets and verifies introduced whitespace/conflict markers, then returns before language tooling. Docs-only pre-push scans the exact pushed revisions' reachable history with pinned, redacted Gitleaks before checking maintained-file whitespace/conflict markers in each pushed tree. Manual/CI hygiene follows the same order so Git diagnostics cannot print a detected secret on a whitespace-error line. Docs-only hooks run no application build, test, coverage, or E2E commands. Missing hygiene tools still fail with setup instructions.

For new branch pushes, compare the proposed commit against its merge base with locally known `origin/main`. Use this comparison only when it proves a nonempty docs-only change; otherwise retain the complete-tree fallback. Missing main ancestry, unavailable nonzero remote objects, malformed protocol, and mixed pushed refs must not silently exempt code. Existing branch updates still compare Git's exact remote/local IDs. Disable rename detection so both sides of a move participate in the decision.

Keep both push and pull_request triggers without top-level path filters. The existing hygiene job runs first and emits a `run_application_checks` output from the shared Node selector. It always installs the pinned scanner and runs committed hygiene, but skips root dependency installation/regression tests for docs-only events. PR selection uses the complete base/head three-dot diff; push selection uses Git's before/after IDs and the new-branch policy above. Missing objects/unknown event types conservatively select full work; malformed IDs fail closed.

Backend/frontend/coverage jobs depend on hygiene and are conditionally skipped for docs-only events. Both existing authentication E2E matrix jobs still expand and report a lightweight success notice; all of their checkout/setup/install/build/test steps are conditional. This preserves the `current`/`phase1` check contexts without running browsers, Docker services, or application tests for docs. A failed hygiene check still blocks the workflow.

Root Markdown, `.mdx`, uppercase `.MD`, non-Markdown docs files, and source/tooling changes retain normal selection. A docs-only latest commit does not make a mixed code PR docs-only. Explicit manual hygiene/coverage commands keep full scope. No hosted repository rules, credentials, or developer data are changed.

## Consequences and alternatives

Documentation gets a fast path while retaining protection against accidentally pasted credentials and unresolved conflict markers. A docs-only operation can still fail hygiene and needs the installed scanner. No scanner allowlist or automatic fixing/staging is introduced.

Using local Git diffs inside the workflow avoids GitHub API changed-file pagination limits and allows identical path policy in hooks and CI. The full history checkout and Node/scanner setup remain a small CI cost. Two E2E matrix runners perform only success notices for docs-only events; this is an explicit tradeoff for stable existing check names.

GitHub documents that conditionally skipped jobs report success, unlike an entirely path-skipped workflow's potentially pending required checks. Existing check names are retained; hosted branch protection is unchanged. Skipping all checks or the entire workflow was rejected after review because the speed benefit does not justify losing inexpensive hygiene or predictable status reporting.

Tests cover scoped additions/edits/deletions, rename boundaries, nested/spaced paths, first-push hygiene, unknown/mixed refs, unchanged index/worktree, synthetic secret and whitespace rejection, full PR versus latest-push scope, and workflow/matrix gating. Five revised/new cases failed against the initial broad exemption before passing with the narrowed policy. See [learning note 013](../learning/013-git-hooks-and-ci.md#documentation-only-fast-path) for examples and verification.

## References

- [GitHub conditional-job success semantics](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions).
- [Passing job outputs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/pass-job-outputs).
