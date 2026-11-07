# 020 — Coverage reports and a non-degradation gate

## What coverage means here

A passing test proves its assertions held. **Line coverage** counts executable source lines reached by tests. **Branch coverage** counts decision paths, such as the valid and invalid purchase-date branches in `Expense.TryCreate`. A test can execute a line without asserting its result, so coverage complements behavior tests rather than replacing them.

PocketLedger uses Coverlet with its existing xUnit/VSTest suites, ReportGenerator to merge/read backend results, and Vitest's V8 provider for React/TypeScript. See [ADR 0018](../decisions/0018-coverage-regression-gate.md).

The first full measurements at baseline `59929726e1394d4a29eb3b7a63412bc58b339c2e` are:

| Area | Covered / executable lines | Line coverage | Covered / executable branches | Branch coverage |
| --- | ---: | ---: | ---: | ---: |
| Domain | 102 / 108 | 94.44% | 30 / 32 | 93.75% |
| UseCases | 264 / 303 | 87.13% | 98 / 129 | 75.97% |
| Infrastructure | 421 / 507 | 83.04% | 79 / 128 | 61.72% |
| Api | 25 / 28 | 89.29% | 6 / 8 | 75.00% |
| ServiceDefaults | 57 / 67 | 85.07% | 15 / 18 | 83.33% |
| Backend combined | 869 / 1013 | 85.78% | 228 / 315 | 72.38% |
| Web | 236 / 263 | 89.73% | 232 / 275 | 84.36% |

Backend results merge all three suites, including 84 PostgreSQL API tests, without double-counting Domain lines reached by several suites. The complete run has 109 backend and 28 frontend behavior tests. Frontend reports include unimported code (`main.tsx`) and development pages. Generated EF migration code and test/type-declaration files are excluded. These percentages do not include AppHost orchestration, root tooling, Java provider code, hosted theme JavaScript, or backend/frontend execution inside the separate Keycloak E2E suite. Those areas retain their existing build and acceptance checks.

## Collect and inspect

From the repository root, after normal dependency installation and with Docker running:

```sh
npm run coverage
npm run coverage:check
# Explicit reproducible comparison, without fetching a different target:
node scripts/coverage.mjs check --base <base-sha> --head <head-sha>
```

For frontend coverage alone, `npm --prefix src/PocketLedger.Web run test:coverage` needs its installed npm dependencies but not Docker/.NET. Backend-only collection is `node scripts/coverage.mjs collect --area backend`.

Full local reports are ignored under `.artifacts/coverage/current/backend/index.html` and `frontend/index.html`. The backend also writes `Summary.json` and merged `Cobertura.xml`; frontend writes `coverage-summary.json` and LCOV. Gate reports use `.artifacts/coverage/<head-prefix>-vs-<base-prefix>/`, with `base`/`head` reports plus `comparison.md` and exact counters in `comparison.json`. CI publishes the table as its job summary and retains `coverage-reports` artifacts for 14 days, including failures.

Read a report by choosing an assembly/file and inspecting uncovered source. For example, Infrastructure's lower branch result identifies paths not exercised by HTTP integration tests, including provider callbacks mostly exercised by the separate real-Keycloak acceptance suite. Do not delete those paths or hide files merely to increase a percentage.

## How the gate works

Git has no native pre-PR hook. The existing Lefthook pre-push dispatcher runs coverage after relevant checks. It reads all pushed refs, fetches main, archives each exact pushed commit plus main, and tests the independent snapshots. An unstaged passing test cannot improve coverage of the committed candidate. Deleted refs require no checks. New branches/missing remote objects conservatively select the whole pushed tree. No source/index changes, auto-staging, developer databases, or Aspire startup are involved.

A source change in one area collects that area; shared coverage/tooling changes collect both. The backend includes Docker-dependent API tests, so this strengthens ADR 0012's original Docker-free push policy. Two fresh coverage runs and dependency installation cost more than a fixed threshold, but compare real code without manually updating baseline numbers. Missing Docker/network/tools/reports fail rather than silently accepting an old result. Builds and source snapshots are isolated; temporary dependencies are removed even on failure.

The comparator checks each module's lines and branches separately with exact integer cross-products. For example, `80/100` versus `80/101` is a regression even though displayed percentages may round similarly. Zero branch opportunities mean no branch can be missed; when new branches appear, their coverage must preserve that ratio. Scope changes and missing/empty reports require an explicit policy correction, not a fabricated 100% result.

CI compares GitHub’s tested PR merge candidate (`github.sha`) against the event’s base SHA, catching interactions with main even when a branch is behind. Local hooks instead test each exact pushed commit before a PR exists. Main pushes compare previous main, and feature pushes compare fresh main. Its job is independent of local hook bypasses; protecting merges requires the repository owner to require `coverage` in branch protection, alongside existing checks.

## Verification evidence

- The identical committed baseline/head comparison passed all twelve module/metric checks using real collectors, including automatic bootstrap of the pre-coverage main revision.
- A disposable repository retained baseline source but removed `App.test.tsx` in a candidate commit. Real V8 coverage fell from **236/263 (89.73%)** to **163/263 (61.98%)** lines, and **232/275 (84.36%)** to **154/275 (56.00%)** branches. The gate rejected it and retained reports. The working project's tests/history were not altered.
- Tooling regressions cover equality/improvement, uncovered new code, tiny fractional decreases, large counters, per-module branch regression, zero denominators, invalid/partial/duplicate reports, changed scopes, every pushed ref/deletion, missing/failing baseline fetch, exact committed snapshots despite staged/unstaged/untracked files, failure reports, cleanup, and successful-then-failed reruns without stale passing artifacts.
- The installed hook initially rejected baseline bootstrap because an install option ignored the lockfile and changed existing dependency versions. Honoring the original lockfile fixed setup; the version-preservation guard remains in place. The real feature-versus-main frontend comparison then passed with unchanged counters.
- Full application checks and the final feature-versus-main hook result are recorded with the implementation PR.

The percentage is a floor based on actual main, not a target to game. A future additional runtime project must be included deliberately in the collection/comparison policy. A deliberate lower-coverage architectural change needs a reviewed policy decision rather than a hidden tolerance.

## Exercise

1. Open the `Money` report. Which public operations remain uncovered, and what observable assertions would make useful tests for them?
2. Why does adding an uncovered branch lower coverage even if every old test still passes?
3. Explain why an unrelated Infrastructure improvement should not compensate for losing an Expense invariant test in Domain.
4. In a disposable repository, remove one behavior test and run a comparison. Inspect the rejected counters and confirm your original checkout is unchanged.
5. How can a test execute every line while checking almost nothing? Improve one assertion without changing the coverage percentage.
