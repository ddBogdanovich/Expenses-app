import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const toolingRoot = fileURLToPath(new URL('../', import.meta.url))
const webDirectory = 'src/PocketLedger.Web'
const archiveMaximumBytes = 128 * 1024 * 1024
const percentageScale = 100
const revisionLabelLength = 12
export const backendAssemblies = ['Api', 'Domain', 'Infrastructure', 'ServiceDefaults', 'UseCases'].map(name => `PocketLedger.${name}`)
const testProjects = ['Domain', 'UseCases', 'Api'].map(name => `tests/PocketLedger.${name}.Tests/PocketLedger.${name}.Tests.csproj`)
const metrics = ['lines', 'branches']
const frontendPolicy = {
  provider: 'v8', include: ['src/**/*.{ts,tsx}'], exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/*.d.ts'],
  reporter: ['text-summary', 'json-summary', 'html', 'lcov'],
}

function execute(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', ...options })
  if (result.error || result.status !== 0) throw new Error(`${command} ${args[0]} failed (${result.status ?? result.error?.message}).${result.stderr ? `\n${result.stderr}` : ''}`)
  return result.stdout
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`)
  execute(command, args, cwd, { stdio: 'inherit' })
}

function npm(args, cwd) {
  if (process.platform === 'win32') {
    // Fixed npm subcommands and pinned package versions only; no source text enters a shell.
    run('cmd.exe', ['/d', '/s', '/c', 'npm', ...args], cwd)
  } else run('npm', args, cwd)
}

function json(path) { return JSON.parse(readFileSync(path, 'utf8')) }

function counter(covered, total) {
  if (!Number.isSafeInteger(covered) || !Number.isSafeInteger(total) || covered < 0 || covered > total) {
    throw new Error('Coverage contains invalid or missing counters.')
  }
  return { covered, total }
}

export function backendMetrics(report) {
  const assemblies = report.coverage?.assemblies
  if (!Array.isArray(assemblies) || assemblies.length !== backendAssemblies.length) throw new Error('Backend coverage assembly inventory is incomplete.')
  return Object.fromEntries(backendAssemblies.map(name => {
    const matching = assemblies.filter(assembly => assembly.name === name)
    if (matching.length !== 1 || matching[0].coverablelines <= 0) throw new Error(`Missing/empty coverage for ${name}.`)
    const assembly = matching[0]
    return [name, { lines: counter(assembly.coveredlines, assembly.coverablelines), branches: counter(assembly.coveredbranches, assembly.totalbranches) }]
  }))
}

export function frontendMetrics(report) {
  if (!report.total || report.total.lines?.total <= 0) throw new Error('Frontend coverage is missing or empty.')
  return { Web: Object.fromEntries(metrics.map(metric => [metric, counter(report.total[metric]?.covered, report.total[metric]?.total)])) }
}

function fraction(value) { return value.total === 0 ? { covered: 1n, total: 1n } : { covered: BigInt(value.covered), total: BigInt(value.total) } }
function percentage(value) { return (value.total === 0 ? percentageScale : value.covered * percentageScale / value.total).toFixed(2) }

export function compareCoverage(base, head) {
  if (!Object.keys(base).length) throw new Error('Coverage scope is empty.')
  if (Object.keys(base).sort().join('\0') !== Object.keys(head).sort().join('\0')) throw new Error('Coverage scope changed: missing, added, or renamed module.')
  const rows = []
  const regressions = []
  for (const [module, values] of Object.entries(base)) {
    for (const metric of metrics) {
      const before = counter(values[metric]?.covered, values[metric]?.total)
      const after = counter(head[module]?.[metric]?.covered, head[module]?.[metric]?.total)
      const b = fraction(before)
      const h = fraction(after)
      const degraded = h.covered * b.total < b.covered * h.total
      const row = { module, metric, base: before, head: after, degraded }
      rows.push(row)
      if (degraded) regressions.push(`${module} ${metric}: ${percentage(before)}% (${before.covered}/${before.total}) → ${percentage(after)}% (${after.covered}/${after.total})`)
    }
  }
  return { rows, regressions }
}

export function snapshot(repository, revision, destination) {
  mkdirSync(destination, { recursive: true })
  // Archive contains the requested committed tree only, never unstaged/staged edits or ignored credentials.
  const archive = execute('git', ['archive', '--format=tar', revision], repository, { encoding: null, maxBuffer: archiveMaximumBytes })
  execute('tar', ['-xf', '-', '-C', destination], repository, { input: archive })
}

function backend(root, output, bootstrap) {
  const projects = readdirSync(join(root, 'src'), { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(entry =>
    readdirSync(join(root, 'src', entry.name)).filter(file => file.endsWith('.csproj')).map(file => file.slice(0, -'.csproj'.length))).sort()
  if (projects.join('\0') !== [...backendAssemblies].sort().join('\0')) throw new Error('Backend project inventory changed; extend the coverage policy to include every runtime project.')
  for (const project of testProjects) {
    const path = join(root, project)
    const original = readFileSync(path, 'utf8')
    // Bootstrap the pre-coverage main revision in the disposable snapshot. Never change application code or tests.
    if (!original.includes('Include="coverlet.collector"')) {
      if (!bootstrap) throw new Error('A test project is missing coverlet.collector.')
      writeFileSync(path, original.replace('</Project>', '  <ItemGroup><PackageReference Include="coverlet.collector" /></ItemGroup>\n</Project>'))
    }
  }
  const reports = join(output, 'backend')
  const raw = join(reports, 'raw')
  const buildArguments = ['--artifacts-path', join(root, '.artifacts/coverage-build')]
  run('dotnet', ['build', 'PocketLedger.slnx', ...buildArguments], root)
  run('dotnet', ['test', 'PocketLedger.slnx', '--no-build', '--no-restore', ...buildArguments,
    '--collect', 'XPlat Code Coverage', '--settings', join(toolingRoot, 'coverage.runsettings'), '--results-directory', raw], root)
  const files = readdirSync(raw, { recursive: true }).filter(file => file.endsWith('coverage.cobertura.xml'))
  if (files.length !== testProjects.length) throw new Error(`Expected ${testProjects.length} collector reports; received ${files.length}.`)
  run('dotnet', ['tool', 'run', 'reportgenerator', `-reports:${join(raw, '**', 'coverage.cobertura.xml')}`, `-targetdir:${reports}`, '-reporttypes:Html;JsonSummary;Cobertura'], toolingRoot)
  return backendMetrics(json(join(reports, 'Summary.json')))
}

function frontend(root, output, install) {
  const web = join(root, webDirectory)
  if (install) npm(['ci'], web)
  const version = json(join(web, 'node_modules/vitest/package.json')).version
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Unsupported baseline Vitest version.')
  const provider = join(web, 'node_modules/@vitest/coverage-v8/package.json')
  if (!existsSync(provider)) {
    if (!install) throw new Error('V8 coverage provider is missing. Run npm ci in the frontend.')
    const locked = json(join(web, 'package-lock.json')).packages
    const installed = Object.entries(locked).filter(([path]) => path && existsSync(join(web, path, 'package.json')))
      .map(([path]) => [path, json(join(web, path, 'package.json')).version])
    npm(['install', '--no-save', '--package-lock=false', '--ignore-scripts', `@vitest/coverage-v8@${version}`], web)
    if (installed.some(([path, previous]) => !existsSync(join(web, path, 'package.json')) || json(join(web, path, 'package.json')).version !== previous)) {
      throw new Error('Coverage bootstrap changed a locked baseline dependency; comparison is not reproducible.')
    }
  }
  if (json(provider).version !== version) throw new Error('Vitest and its V8 coverage provider must have identical versions.')
  const temporary = mkdtempSync(join(web, '.coverage-config-'))
  try {
    const configuration = join(temporary, 'vitest.config.ts')
    // Identical scope/reporting policy for both revisions; preserve the revision's test/plugin setup.
    writeFileSync(configuration, `import original from '../vitest.config'\nexport default { ...original, test: { ...original.test, coverage: ${JSON.stringify({ ...frontendPolicy, enabled: true, reportsDirectory: join(output, 'frontend') })} } }\n`)
    run(process.execPath, [join(web, 'node_modules/vitest/vitest.mjs'), 'run', '--config', configuration], web)
  } finally { rmSync(temporary, { recursive: true, force: true }) }
  return frontendMetrics(json(join(output, 'frontend/coverage-summary.json')))
}

export function collect(root, output, areas, install = false) {
  mkdirSync(output, { recursive: true })
  rmSync(join(output, 'summary.json'), { force: true })
  for (const area of areas) rmSync(join(output, area), { recursive: true, force: true })
  const result = { ...(areas.includes('backend') ? backend(root, output, install) : {}), ...(areas.includes('frontend') ? frontend(root, output, install) : {}) }
  writeFileSync(join(output, 'summary.json'), JSON.stringify(result, null, 2) + '\n')
  return result
}

function commit(repository, reference) { return execute('git', ['rev-parse', '--verify', `${reference}^{commit}`], repository).trim() }

export function resolveBase(repository, reference) {
  if (reference && !/^0+$/.test(reference)) return commit(repository, reference)
  // A stale/missing target is never silently treated as the current baseline.
  execute('git', ['fetch', '--no-tags', 'origin', 'main:refs/remotes/origin/main'], repository)
  return commit(repository, 'origin/main')
}

function markdown(comparison, base, head) {
  return `# Coverage comparison\n\nBase: ${base}\nHead: ${head}\n\n| Module | Metric | Base | Head | Result |\n| --- | --- | --- | --- | --- |\n` + comparison.rows.map(row =>
    `| ${row.module} | ${row.metric} | ${percentage(row.base)}% (${row.base.covered}/${row.base.total}) | ${percentage(row.head)}% (${row.head.covered}/${row.head.total}) | ${row.degraded ? 'REGRESSION' : 'Pass'} |`).join('\n') + '\n'
}

export function check(repository, baseRevision, headRevision, areas, output, collector = collect) {
  // A failed rerun must never publish a previous run's passing comparison.
  rmSync(output, { recursive: true, force: true })
  mkdirSync(output, { recursive: true })
  const temporary = mkdtempSync(join(tmpdir(), 'pocketledger-coverage-'))
  try {
    const base = join(temporary, 'base')
    const head = join(temporary, 'head')
    snapshot(repository, baseRevision, base)
    snapshot(repository, headRevision, head)
    const before = collector(base, join(output, 'base'), areas, true)
    const after = collector(head, join(output, 'head'), areas, true)
    const comparison = compareCoverage(before, after)
    mkdirSync(output, { recursive: true })
    writeFileSync(join(output, 'comparison.json'), JSON.stringify({ base: baseRevision, head: headRevision, ...comparison }, null, 2) + '\n')
    const table = markdown(comparison, baseRevision, headRevision)
    writeFileSync(join(output, 'comparison.md'), table)
    console.log(table)
    if (process.env.GITHUB_STEP_SUMMARY && collector === collect) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table + '\n')
    if (comparison.regressions.length) throw new Error(`Coverage degraded:\n${comparison.regressions.join('\n')}\nReports retained at ${output}`)
  } catch (error) {
    writeFileSync(join(output, 'failure.json'), JSON.stringify({ base: baseRevision, head: headRevision, status: 'failed' }, null, 2) + '\n')
    throw error
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}

export function main(args = process.argv.slice(2), repository = toolingRoot) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    base: { type: 'string' }, head: { type: 'string', multiple: true }, area: { type: 'string', multiple: true },
  } })
  const areas = values.area ?? ['backend', 'frontend']
  if (!areas.length || areas.some(area => !['backend', 'frontend'].includes(area))) throw new Error('Choose backend and/or frontend coverage.')
  if (areas.includes('backend')) run('dotnet', ['tool', 'restore', '--tool-manifest', join(toolingRoot, '.config/dotnet-tools.json')], toolingRoot)
  if (positionals[0] === 'collect') {
    const output = join(repository, '.artifacts/coverage/current')
    const summary = collect(repository, output, areas)
    console.log(JSON.stringify(summary, null, 2))
    console.log(`Coverage reports: ${output}`)
  } else if (positionals[0] === 'check') {
    const base = resolveBase(repository, values.base)
    for (const reference of values.head ?? ['HEAD']) {
      const head = commit(repository, reference)
      check(repository, base, head, areas, join(repository, '.artifacts/coverage', `${head.slice(0, revisionLabelLength)}-vs-${base.slice(0, revisionLabelLength)}`))
    }
  } else throw new Error('Choose collect or check.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
