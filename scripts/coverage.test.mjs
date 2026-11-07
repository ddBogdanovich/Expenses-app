import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test } from 'node:test'
import { backendAssemblies, backendMetrics, check, compareCoverage, frontendMetrics, resolveBase, snapshot } from './coverage.mjs'
import { pushedCommits } from './checks.mjs'

const measure = (covered, total, branchCovered = covered, branchTotal = total) => ({ lines: { covered, total }, branches: { covered: branchCovered, total: branchTotal } })

test('gate allows equal/improved coverage but rejects decreases including previously uncovered new code', () => {
  assert.deepEqual(compareCoverage({ Web: measure(80, 100) }, { Web: measure(80, 100) }).regressions, [])
  assert.deepEqual(compareCoverage({ Web: measure(80, 100) }, { Web: measure(81, 100) }).regressions, [])
  assert.equal(compareCoverage({ Web: measure(80, 100) }, { Web: measure(80, 101) }).regressions.length, 2)
})

test('exact fractions reject a decrease hidden by rounded percentages and prevent large-integer overflow', () => {
  assert.equal(compareCoverage({ Web: measure(800000, 1000000) }, { Web: measure(800000, 1000001) }).regressions.length, 2)
  const total = Number.MAX_SAFE_INTEGER
  assert.equal(compareCoverage({ Web: measure(total - 1, total) }, { Web: measure(total - 2, total) }).regressions.length, 2)
})

test('module and branch regressions cannot be hidden by coverage gains elsewhere', () => {
  const comparison = compareCoverage({ Domain: measure(9, 10), Infrastructure: measure(1, 10) },
    { Domain: measure(9, 10, 8, 10), Infrastructure: measure(10, 10) })
  assert.equal(comparison.regressions.length, 1)
  assert.match(comparison.regressions[0], /Domain branches/)
})

test('zero executable branches is vacuously covered, while missing/invalid counters and scope changes fail', () => {
  assert.equal(compareCoverage({ Web: measure(1, 1, 0, 0) }, { Web: measure(1, 1, 0, 1) }).regressions.length, 1)
  assert.deepEqual(compareCoverage({ Web: measure(1, 1, 0, 0) }, { Web: measure(1, 1, 1, 1) }).regressions, [])
  for (const invalid of [-1, NaN, Infinity, 1.5, undefined]) {
    assert.throws(() => compareCoverage({ Web: measure(1, 1) }, { Web: measure(invalid, 1) }), /invalid or missing counters/)
  }
  assert.throws(() => compareCoverage({}, {}), /scope is empty/)
  assert.throws(() => compareCoverage({ Web: measure(1, 1) }, {}), /scope changed/)
  assert.throws(() => compareCoverage({ Web: measure(1, 1) }, { Web: measure(1, 1), Extra: measure(1, 1) }), /scope changed/)
})

test('standard merged ReportGenerator inventory rejects missing, duplicate, and empty assemblies', () => {
  const assemblies = backendAssemblies.map(name => ({ name, coveredlines: 9, coverablelines: 10, coveredbranches: 1, totalbranches: 2 }))
  assert.equal(Object.keys(backendMetrics({ coverage: { assemblies } })).length, 5)
  assert.throws(() => backendMetrics({ coverage: { assemblies: assemblies.slice(1) } }), /inventory/)
  assert.throws(() => backendMetrics({ coverage: { assemblies: [...assemblies.slice(1), assemblies[1]] } }), /Missing/)
  assert.throws(() => backendMetrics({ coverage: { assemblies: assemblies.map(value => ({ ...value, coverablelines: 0 })) } }), /empty/)
  assert.throws(() => frontendMetrics({}), /missing or empty/)
  assert.throws(() => frontendMetrics({ total: { lines: { covered: 0, total: 0 } } }), /missing or empty/)
})

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'pocketledger-coverage-test-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  git('init', '--initial-branch=main')
  git('config', 'user.name', 'Coverage fixture')
  git('config', 'user.email', 'coverage@example.test')
  git('config', 'core.hooksPath', '.git/hooks')
  git('config', 'commit.gpgsign', 'false')
  writeFileSync(join(cwd, 'source.ts'), 'committed\n')
  git('add', '.')
  git('commit', '-m', 'Disposable test fixture')
  return { cwd, git }
}

test('snapshot measures committed code, excludes dirty/index/untracked content, and leaves checkout unchanged', t => {
  const { cwd, git } = repository(t)
  const revision = git('rev-parse', 'HEAD')
  writeFileSync(join(cwd, 'source.ts'), 'staged\n')
  git('add', '.')
  writeFileSync(join(cwd, 'source.ts'), 'unstaged\n')
  writeFileSync(join(cwd, 'private.txt'), 'untracked\n')
  const index = git('write-tree')
  const destination = join(cwd, 'snapshot')
  snapshot(cwd, revision, destination)
  assert.equal(readFileSync(join(destination, 'source.ts'), 'utf8'), 'committed\n')
  assert.throws(() => readFileSync(join(destination, 'private.txt')), /ENOENT/)
  assert.equal(git('write-tree'), index)
  assert.equal(readFileSync(join(cwd, 'source.ts'), 'utf8'), 'unstaged\n')
  assert.equal(git('rev-parse', 'HEAD'), revision)
})

test('every pushed ref is checked even when not HEAD; deletions skip and missing baseline fails closed', t => {
  const { cwd, git } = repository(t)
  const first = git('rev-parse', 'HEAD')
  writeFileSync(join(cwd, 'source.ts'), 'second\n')
  git('add', '.')
  git('commit', '-m', 'Second fixture revision')
  const second = git('rev-parse', 'HEAD')
  const zero = '0'.repeat(40)
  assert.deepEqual(pushedCommits(`refs/heads/other ${first} refs/heads/other ${zero}\nrefs/heads/main ${second} refs/heads/main ${first}\n`, cwd), [first, second])
  assert.deepEqual(pushedCommits(`(delete) ${zero} refs/heads/removed ${first}\n`, cwd), [])
  assert.deepEqual(pushedCommits('', cwd), [second])
  assert.throws(() => pushedCommits('broken', cwd), /Invalid Git pre-push/)
  assert.throws(() => resolveBase(cwd), /fetch failed/)
  assert.throws(() => resolveBase(cwd, zero), /fetch failed/)
  assert.throws(() => resolveBase(cwd, 'missing'), /rev-parse failed/)
  assert.equal(resolveBase(cwd, first), first)
})


test('failed comparisons retain exact counters/reports, clean snapshots, and preserve the repository', t => {
  t.mock.method(console, 'log', () => {})
  const { cwd, git } = repository(t)
  const first = git('rev-parse', 'HEAD')
  writeFileSync(join(cwd, 'source.ts'), 'candidate\n')
  git('add', '.')
  git('commit', '-m', 'Candidate fixture')
  const second = git('rev-parse', 'HEAD')
  const roots = []
  const output = join(cwd, 'reports')
  const collector = (root, reports) => {
    roots.push(root)
    const contents = readFileSync(join(root, 'source.ts'), 'utf8')
    return { Web: measure(contents.includes('candidate') ? 7 : 8, 10) }
  }
  assert.throws(() => check(cwd, first, second, ['frontend'], output, collector), /Coverage degraded/)
  assert.ok(roots.every(root => !existsSync(root)))
  const comparison = JSON.parse(readFileSync(join(output, 'comparison.json'), 'utf8'))
  assert.equal(comparison.regressions.length, 2)
  assert.deepEqual(comparison.rows[0].head, { covered: 7, total: 10 })
  assert.match(readFileSync(join(output, 'comparison.md'), 'utf8'), /REGRESSION/)
  assert.equal(git('rev-parse', 'HEAD'), second)
  assert.equal(readFileSync(join(cwd, 'source.ts'), 'utf8'), 'candidate\n')
})


test('a failed rerun removes earlier passing comparisons and stale reports', t => {
  t.mock.method(console, 'log', () => {})
  const { cwd, git } = repository(t)
  const revision = git('rev-parse', 'HEAD')
  const output = join(cwd, 'reports')
  check(cwd, revision, revision, ['frontend'], output, () => ({ Web: measure(1, 1) }))
  assert.ok(existsSync(join(output, 'comparison.json')))
  writeFileSync(join(output, 'old-report.html'), 'previous success')
  const roots = []
  assert.throws(() => check(cwd, revision, revision, ['frontend'], output, root => {
    roots.push(root)
    throw new Error('Collector unavailable')
  }), /Collector unavailable/)
  assert.ok(roots.every(root => !existsSync(root)))
  assert.ok(!existsSync(join(output, 'comparison.json')))
  assert.ok(!existsSync(join(output, 'comparison.md')))
  assert.ok(!existsSync(join(output, 'old-report.html')))
  assert.equal(JSON.parse(readFileSync(join(output, 'failure.json'), 'utf8')).status, 'failed')
})
