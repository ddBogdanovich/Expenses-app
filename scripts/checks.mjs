import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const solution = 'PocketLedger.slnx'
const webDirectory = 'src/PocketLedger.Web'
const hookArtifacts = '.artifacts/hooks'
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

export function affectedAreas(files) {
  const shared = files.some(file => /^(coverage\.runsettings$|\.config\/|scripts\/|\.lefthook\/|\.github\/|package(?:-lock)?\.json$|lefthook\.yml$|\.editorconfig$|\.gitattributes$|\.gitleaks\.toml$)/.test(file))
  return {
    backend: shared || files.some(file => /^(PocketLedger\.AppHost\/|tests\/|src\/PocketLedger\.(?!Web\/))/.test(file)
      || /(?:\.(?:cs|csproj|props|targets|slnx)|global\.json|[Nn]u[Gg]et\.[Cc]onfig)$/.test(file)),
    frontend: shared || files.some(file => file.startsWith(`${webDirectory}/`)),
  }
}

// Read Git's actual pre-push protocol, including new branches, deletions and multiple refs.
// If a remote object is unavailable locally, checking every file is the safe fallback.
export function pushedFiles(input, cwd) {
  if (!input.trim()) return paths(git(['ls-files', '-z'], cwd))
  const files = new Set()
  for (const line of input.trim().split('\n')) {
    const [localRef, localId, remoteRef, remoteId, extra] = line.trim().split(/\s+/)
    if (!localRef || !remoteRef || !/^[a-f0-9]{40,64}$/.test(localId ?? '')
      || !/^[a-f0-9]{40,64}$/.test(remoteId ?? '') || extra) {
      throw new Error('Invalid Git pre-push input.')
    }
    if (zeroObjectId.test(localId)) continue
    const remoteExists = !zeroObjectId.test(remoteId)
      && spawnSync('git', ['cat-file', '-e', `${remoteId}^{commit}`], { cwd, stdio: 'ignore' }).status === 0
    const changed = remoteExists
      ? git(['diff', '--name-only', '--no-renames', '-z', remoteId, localId, '--'], cwd)
      : git(['ls-tree', '-r', '--name-only', '-z', localId], cwd)
    for (const file of paths(changed)) files.add(file)
  }
  return [...files]
}

export function pushedCommits(input, cwd) {
  // Reuse protocol validation, including deletions and malformed IDs.
  pushedFiles(input, cwd)
  if (!input.trim()) return [git(['rev-parse', 'HEAD'], cwd).trim()]
  return [...new Set(input.trim().split('\n').map(line => line.trim().split(/\s+/)[1]).filter(id => !zeroObjectId.test(id)))]
}

function run(command, args, cwd) {
  console.log(`\n> ${command === process.execPath ? 'node' : command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`Check failed (${result.signal ?? result.status}).`)
}

function scanSecrets(cwd, staged = false) {
  const executable = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks'
  const binary = resolve(cwd, '.tools', `gitleaks-${gitleaks.version}`, executable)
  if (!existsSync(binary)) throw new Error('Gitleaks is missing. Run npm run hooks:install from the repository root.')
  run(binary, ['git', '--redact', '--no-banner', ...(staged ? ['--pre-commit', '--staged'] : [])], cwd)
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

function backend(cwd, fullSuite) {
  // Local push builds do not overwrite assemblies used by a running Aspire API.
  const artifacts = fullSuite ? [] : ['--artifacts-path', hookArtifacts]
  run('dotnet', ['restore', solution, ...artifacts], cwd)
  run('dotnet', ['build', solution, '--no-restore', ...artifacts], cwd)
  if (fullSuite) {
    run('dotnet', ['test', solution, '--no-build'], cwd)
    run('dotnet', ['format', solution, '--no-restore', '--verify-no-changes'], cwd)
  } else {
    for (const name of ['Domain', 'UseCases']) {
      run('dotnet', ['test', `tests/PocketLedger.${name}.Tests/PocketLedger.${name}.Tests.csproj`, '--no-build', ...artifacts], cwd)
    }
  }
}

function stagedChecks(cwd) {
  const changed = paths(git(['diff', '--cached', '--name-only', '--no-renames', '-z'], cwd))
  if (!changed.length) return
  scanSecrets(cwd, true)
  // Git checks introduced whitespace errors and conflict markers against the index.
  run('git', ['diff', '--cached', '--check', ...maintainedFiles], cwd)
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
      const areas = affectedAreas(pushedFiles(input, cwd))
      if (areas.backend || areas.frontend) {
        console.log('Build/lint checks inspect the working tree; coverage compares each pushed commit against fresh origin/main.')
        run(process.execPath, ['--test', 'scripts/checks.test.mjs', 'scripts/coverage.test.mjs'], cwd)
      }
      if (areas.backend) backend(cwd, false)
      if (areas.frontend) frontend(cwd)
      if (areas.backend || areas.frontend) {
        run(process.execPath, ['scripts/coverage.mjs', 'check',
          ...pushedCommits(input, cwd).flatMap(id => ['--head', id]),
          ...Object.entries(areas).filter(([, affected]) => affected).flatMap(([area]) => ['--area', area])], cwd)
      }
      break
    }
    case 'backend':
      backend(cwd, true)
      break
    case 'frontend':
      frontend(cwd)
      break
    case 'hygiene': {
      const emptyTree = git(['hash-object', '-t', 'tree', '--stdin'], cwd, '').trim()
      run('git', ['diff', '--check', emptyTree, 'HEAD', ...maintainedFiles], cwd)
      scanSecrets(cwd)
      break
    }
    default:
      throw new Error('Choose pre-commit, pre-push, backend, frontend, or hygiene.')
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
