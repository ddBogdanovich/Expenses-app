import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const solution = 'PocketLedger.slnx'
const webDirectory = 'src/PocketLedger.Web'
// Installed skills are vendored tools; keep whitespace policy focused on maintained files.
const maintainedFiles = ['--', '.', ':!.agents/skills/**']
const zeroObjectId = /^0+$/
const { gitleaks } = JSON.parse(readFileSync(new URL('./tool-versions.json', import.meta.url), 'utf8'))

function git(args, cwd, input) {
  const result = spawnSync('git', args, { cwd, input, encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr || result.error}`)
  return result.stdout
}

function paths(output) {
  return output.split('\0').filter(Boolean)
}

function onlyDocsMarkdown(files) {
  return files.length > 0 && files.every(file => /^docs\/.+\.md$/.test(file))
}

// Read and validate Git's actual pre-push protocol. Every non-deleted ref is
// checked at its exact local commit, including branches other than the checkout.
export function pushedCommits(input, cwd) {
  if (!input.trim()) return [git(['rev-parse', 'HEAD'], cwd).trim()]
  const commits = new Set()
  for (const line of input.trim().split('\n')) {
    const [localRef, localId, remoteRef, remoteId, extra] = line.trim().split(/\s+/)
    if (!localRef || !remoteRef || !/^[a-f0-9]{40,64}$/.test(localId ?? '')
      || !/^[a-f0-9]{40,64}$/.test(remoteId ?? '') || extra) {
      throw new Error('Invalid Git pre-push input.')
    }
    if (!zeroObjectId.test(localId)) commits.add(localId)
  }
  return [...commits]
}

function affectsIdentityUpgrade(file) {
  if (file === 'src/PocketLedger.Infrastructure/Expenses/CurrentAccount.cs') return true
  return /^(?:infra\/keycloak\/|PocketLedger\.AppHost\/|tests\/PocketLedger\.(?:E2E|Api\.Tests)\/|\.github\/)/.test(file)
    || /^src\/PocketLedger\.(?:Api|ServiceDefaults)\//.test(file)
    || /^src\/PocketLedger\.(?:Domain\/Accounts|UseCases\/(?:Authentication|Common)|Infrastructure\/(?:Authentication|Persistence))\//.test(file)
    || /^src\/PocketLedger\.Web\//.test(file)
    || /^scripts\/(?:configure-keycloak|build-keycloak|checks)/.test(file)
    || /(?:\.(?:csproj|props|targets|slnx)$|^global\.json$|^\.editorconfig$|^package(?:-lock)?\.json$)/.test(file)
    || /^src\/PocketLedger\.(?:UseCases|Infrastructure)\/[^/]+\.cs$/.test(file)
}

function ciScope(eventName, event, cwd) {
  const full = { application: true, upgrade: true }
  let base
  let head
  let range
  if (eventName === 'push') {
    if (event.ref?.startsWith('refs/heads/') && event.ref !== 'refs/heads/main') {
      return { application: false, upgrade: false }
    }
    if (event.ref !== 'refs/heads/main') return full
    base = event.before
    head = event.after
    range = '..'
  } else if (eventName === 'pull_request') {
    base = event.pull_request?.base?.sha
    head = event.pull_request?.head?.sha
    range = '...'
    if (![base, head].every(id => /^[a-f0-9]{40,64}$/.test(id ?? ''))) throw new Error('Invalid pull-request commit IDs.')
  } else return full
  if (![base, head].every(id => /^[a-f0-9]{40,64}$/.test(id ?? '') && !zeroObjectId.test(id))) return full
  if ([base, head].some(id => spawnSync('git', ['cat-file', '-e', `${id}^{commit}`], { cwd, stdio: 'ignore' }).status !== 0)) return full
  const files = paths(git(['diff', '--name-only', '--no-renames', '-z', `${base}${range}${head}`, '--'], cwd))
  return {
    application: eventName === 'push' || !onlyDocsMarkdown(files),
    upgrade: files.some(affectsIdentityUpgrade),
  }
}

function run(command, args, cwd) {
  console.log(`\n> ${command === process.execPath ? 'node' : command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`Check failed (${result.signal ?? result.status}).`)
}

function scanSecrets(cwd, staged = false, revisions = []) {
  const executable = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks'
  const binary = resolve(cwd, '.tools', `gitleaks-${gitleaks.version}`, executable)
  if (!existsSync(binary)) throw new Error('Gitleaks is missing. Run npm run hooks:install from the repository root.')
  run(binary, ['git', '--redact', '--no-banner', ...(staged ? ['--pre-commit', '--staged'] : []),
    ...(revisions.length ? ['--log-opts', revisions.join(' ')] : [])], cwd)
}

function committedHygiene(cwd, revisions, { allRefs = false } = {}) {
  // Whitespace diagnostics print offending lines, so redact/reject secrets first.
  scanSecrets(cwd, false, allRefs ? [] : revisions)
  const emptyTree = git(['hash-object', '-t', 'tree', '--stdin'], cwd, '').trim()
  for (const revision of revisions) run('git', ['diff', '--check', emptyTree, revision, ...maintainedFiles], cwd)
}

function frontend(cwd) {
  const web = resolve(cwd, webDirectory)
  // Reuse the frontend's scripts so CI and hooks follow future build/test changes.
  for (const script of ['lint', 'build', 'test']) {
    if (process.platform === 'win32') {
      // npm.cmd needs cmd.exe; only these fixed script names enter its command text.
      run('cmd.exe', ['/d', '/s', '/c', `npm run ${script}`], web)
    } else {
      run('npm', ['run', script], web)
    }
  }
}

function backend(cwd) {
  run('dotnet', ['restore', solution], cwd)
  run('dotnet', ['build', solution, '--no-restore'], cwd)
  run('dotnet', ['test', solution, '--no-build'], cwd)
  run('dotnet', ['format', solution, '--no-restore', '--verify-no-changes'], cwd)
}

function stagedChecks(cwd) {
  const changed = paths(git(['diff', '--cached', '--name-only', '--no-renames', '-z'], cwd))
  if (!changed.length) return
  scanSecrets(cwd, true)
  // Git checks introduced whitespace errors and conflict markers against the index.
  run('git', ['diff', '--cached', '--check', ...maintainedFiles], cwd)
  if (onlyDocsMarkdown(changed)) return
  const present = paths(git(['diff', '--cached', '--name-only', '--no-renames', '--diff-filter=ACMT', '-z'], cwd))
  const frontendConfigChanged = changed.some(file => file.startsWith(`${webDirectory}/`)
    && /(?:package(?:-lock)?\.json|\.oxlintrc\.json|tsconfig[^/]*\.json)$/.test(file))
  const frontendSources = present.filter(file => file.startsWith(`${webDirectory}/`) && /\.(?:[cm]?[jt]sx?)$/.test(file))
  if (frontendConfigChanged || frontendSources.length) {
    run(process.execPath, ['node_modules/oxlint/bin/oxlint', '--deny-warnings', '--',
      ...(frontendConfigChanged ? ['.'] : frontendSources.map(file => file.slice(webDirectory.length + 1)))], resolve(cwd, webDirectory))
  }
  const csharpConfigChanged = changed.some(file => /(?:^\.editorconfig$|\.(?:csproj|props|targets|slnx)$|^global\.json$)/.test(file))
  const csharpSources = present.filter(file => file.endsWith('.cs'))
  if (csharpConfigChanged || csharpSources.length) {
    run('dotnet', ['format', 'whitespace', solution, '--no-restore', '--verify-no-changes',
      ...(csharpConfigChanged ? [] : ['--include', ...csharpSources])], cwd)
  }
}

export function main(mode, cwd = process.cwd(), input = '') {
  switch (mode) {
    case 'pre-commit':
      stagedChecks(cwd)
      break
    case 'pre-push': {
      const commits = pushedCommits(input, cwd)
      if (commits.length) committedHygiene(cwd, commits)
      break
    }
    case 'backend':
      backend(cwd)
      break
    case 'frontend':
      frontend(cwd)
      break
    case 'hygiene': {
      committedHygiene(cwd, ['HEAD'], { allRefs: true })
      break
    }
    case 'ci-scope': {
      if (!process.env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH is required for CI scope selection.')
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
      const scope = ciScope(process.env.GITHUB_EVENT_NAME, event, cwd)
      console.log(`run_application_checks=${scope.application}\nrun_upgrade_checks=${scope.upgrade}`)
      break
    }
    default:
      throw new Error('Choose pre-commit, pre-push, backend, frontend, hygiene, or ci-scope.')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const mode = process.argv[2]
    main(mode, process.cwd(), mode === 'pre-push' ? readFileSync(0, 'utf8') : '')
  } catch (error) {
    console.error(`\n${error.message}`)
    process.exitCode = 1
  }
}
