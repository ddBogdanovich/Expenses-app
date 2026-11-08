# ADR 0018: Measure coverage and reject regressions before push

- Status: Accepted; docs-only/new-branch check selection and unconditional CI application jobs are superseded by [ADR 0021](0021-docs-markdown-check-exclusion.md).
- Date: 2026-11-07
- Supersedes ADR 0012's Docker-free pre-push test policy; retains its Lefthook/staging/CI architecture.

## Context

Passing tests do not reveal which code was never exercised. Coverlet is referenced by the Domain and UseCases suites but coverage was not collected; API tests had no collector. The frontend uses Vitest without a coverage provider. The owner requests industry tooling and a hook that prevents coverage degradation before opening a pull request.

Git has no pull-request-creation hook. Pre-push is the last local Git gate before the usual GitHub Flow PR step. Checking only the working tree could let an unstaged test improvement conceal inadequate coverage in the pushed commit.

## Decision

Use Coverlet's VSTest collector 6.0.4 in all three xUnit v2 test projects, including disposable PostgreSQL API tests. Pin ReportGenerator 5.5.12 in `.config/dotnet-tools.json` and merge overlapping OpenCover reports by their individual branch identities before reading exact JSON counts. Coverlet also emits raw Cobertura; provide HTML, merged Cobertura, and JSON reports. Cobertura condition percentages alone cannot distinguish opposite paths covered by separate suites. Each backend coverage command verifies the pinned merger with complementary-path and duplicate-input contracts before collecting application results. Do not change test frameworks or migrate to Microsoft Testing Platform.

Use the matching pinned `@vitest/coverage-v8` 5.0.5 for the current Vitest installation. Include every frontend `src` TypeScript/TSX implementation file, including unimported files and development routes. Exclude test/spec files and type declarations. Produce HTML, LCOV, JSON summary, and console totals. `scripts/coverage.mjs` owns this policy for both compared revisions and the manual frontend coverage command.

Backend scope is Domain, UseCases, Infrastructure, Api, and ServiceDefaults. Exclude generated EF migrations/snapshots; include handwritten host/session/persistence behavior. Require every runtime assembly and one collector report per test project. Reject missing, duplicate, empty, or unsupported inventories. An added/removed/renamed runtime project requires an explicit coverage-policy update and review; it must not silently disappear from measurement. AppHost orchestration, root tooling, Java provider code, and native hosted theme JavaScript are outside these percentages; their existing build, tooling, and real-service acceptance checks remain separate.

Compare line and branch coverage independently for each backend assembly and the frontend. Use integer counters and `BigInt` cross-products, without percentage rounding or tolerance. Zero executable branches count as fully covered. Improvements in one module cannot hide a regression in another; new uncovered source in a measured module increases its denominator and can fail the gate. Keep function/statement metrics available in the tool reports without inventing an arbitrary minimum percentage.

For relevant pre-push changes, collect both the actual pushed commit and freshly fetched `origin/main` in temporary `git archive` snapshots. Process every non-deleted pushed ref, not just HEAD; preserve the index, working tree, branches, credentials, and any running Aspire session. Existing build/lint checks still inspect the working tree. Coverage builds use isolated artifact paths. A failed fetch, collection, test, dependency installation, or malformed report blocks the push. No stale baseline fallback or tracked percentage snapshot is used. Documentation-only updates to existing branches keep the existing fast path; new branches conservatively select all areas.

Use each snapshot's locked frontend dependencies. To bootstrap the earlier main revision that has no coverage tooling, add missing collector references only in its disposable test projects and install an exact V8 provider matching its lock-backed installed Vitest version. Verify that this installation changed none of the already installed locked versions. Both revisions use the same collection scope and ReportGenerator. Never modify historical application code or test behavior to create a passing baseline.

CI adds a read-only `coverage` job. PRs compare the event's base SHA with GitHub's tested merge SHA (`github.sha`), including interactions with main, feature pushes compare fresh main, and main pushes compare the prior main SHA. A zero/missing push-before SHA resolves to fresh main. Publish comparison tables to the job summary and upload reports on success or failure. Branch protection can require this job; repository settings are not changed by this implementation.

## Costs and alternatives

Relevant backend pushes now require Docker, network access for the fresh baseline/dependency setup, and two full test/coverage runs. Pre-commit remains fast and Docker-free. Baseline reports are not cached initially, avoiding stale-policy/cache invalidation problems. Temporary dependency trees are deleted even on failure; ignored reports remain for investigation.

A fixed threshold would allow regression above that floor. A tracked baseline needs reliable ratcheting and can drift from main; recomputing both revisions avoids manual baseline edits. Codecov or Coveralls can supply hosted dashboards/diff coverage, but add an external service and account/token configuration. Native collectors plus ReportGenerator/Vitest reports meet this project's needs without that dependency. Coverage measures executed code, not assertion quality; the behavior, security, E2E, and visual-review requirements remain.

## Verification

See [learning note 020](../learning/020-coverage-and-regression-gates.md) for actual measurements, positive/negative acceptance, commands, and exercises. [Coverlet](https://github.com/coverlet-coverage/coverlet/blob/master/Documentation/VSTestIntegration.md), [ReportGenerator](https://github.com/danielpalme/ReportGenerator), and [Vitest coverage](https://vitest.dev/guide/coverage) document the selected tools.
