import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { pushedCommits } from './checks.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const zeroId = '0'.repeat(40)

function execute(command, args, cwd, options = {}) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', ...options })
}

function git(cwd, ...args) {
  const result = execute('git', args, cwd)
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'pocketledger-hooks-test-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  git(cwd, 'init', '--initial-branch=main')
  git(cwd, 'config', 'user.email', 'hooks@example.test')
  git(cwd, 'config', 'user.name', 'Hook tests')
  git(cwd, 'config', 'core.hooksPath', '.git/hooks')
  git(cwd, 'config', 'commit.gpgsign', 'false')
  return cwd
}

function commitFile(cwd, file, content) {
  mkdirSync(dirname(join(cwd, file)), { recursive: true })
  writeFileSync(join(cwd, file), content)
  git(cwd, 'add', '--', file)
  git(cwd, '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'Fixture')
  return git(cwd, 'rev-parse', 'HEAD')
}

function installScanner(cwd) {
  const { gitleaks } = JSON.parse(readFileSync(join(root, 'scripts/tool-versions.json'), 'utf8'))
  const executable = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks'
  const directory = join('.tools', `gitleaks-${gitleaks.version}`)
  mkdirSync(join(cwd, directory), { recursive: true })
  copyFileSync(join(root, directory, executable), join(cwd, directory, executable))
}

test('all pre-push refs use hygiene only, including code, new branches, unknown remotes, and multiple refs', t => {
  const cwd = fixture(t)
  installScanner(cwd)
  const first = commitFile(cwd, 'src/PocketLedger.Domain/Money.cs', 'class Money {}\n')
  const second = commitFile(cwd, 'docs/note.md', 'a note\n')
  const third = commitFile(cwd, 'package.json', '{}\n')
  const creation = `refs/heads/code ${first} refs/heads/code ${zeroId}\n`
  const update = `refs/heads/docs ${second} refs/heads/docs ${first}\n`
  const unknown = `refs/heads/tooling ${third} refs/heads/tooling ${'a'.repeat(40)}\n`
  for (const input of [creation, update, unknown, creation + update + unknown, '']) {
    const result = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'pre-push'], cwd, { input })
    assert.doesNotMatch(result.stdout, /> (?:node|dotnet|npm) /)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout, /gitleaks git/)
    assert.match(result.stdout, /git diff --check/)
    const targets = pushedCommits(input, cwd)
    assert.ok(result.stdout.includes(`--log-opts ${targets.join(' ')}`))
    for (const target of targets) assert.ok(result.stdout.includes(` ${target} --`))
  }
  const deletion = `(delete) ${zeroId} refs/heads/old ${first}\n`
  const result = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'pre-push'], cwd, { input: deletion })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.doesNotMatch(result.stdout, /> /)
})

test('docs-only pre-commit retains hygiene without language checks or index/worktree changes', t => {
  const cwd = fixture(t)
  installScanner(cwd)
  commitFile(cwd, 'README.md', 'initial\n')
  for (const file of ['docs/note.md', 'docs/learning/note with spaces.md']) {
    mkdirSync(dirname(join(cwd, file)), { recursive: true })
    writeFileSync(join(cwd, file), 'safe documentation\n')
    git(cwd, 'add', '--', file)
  }
  const before = git(cwd, 'write-tree')
  const result = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'pre-commit'], cwd)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /gitleaks git/)
  assert.match(result.stdout, /git diff --cached --check/)
  assert.doesNotMatch(result.stdout, /> (?:node|dotnet|npm) /)
  assert.equal(git(cwd, 'write-tree'), before)
  assert.equal(readFileSync(join(cwd, 'docs/note.md'), 'utf8'), 'safe documentation\n')

  const syntheticToken = `ghp_${randomBytes(18).toString('hex')}`
  for (const content of ['trailing whitespace  \n', '<<<<<<< ours\nours\n=======\ntheirs\n>>>>>>> theirs\n', `token = "${syntheticToken}"\n`]) {
    writeFileSync(join(cwd, 'docs/note.md'), content)
    git(cwd, 'add', 'docs/note.md')
    const staged = git(cwd, 'write-tree')
    const failure = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'pre-commit'], cwd)
    assert.equal(failure.status, 1)
    assert.ok(!(failure.stdout + failure.stderr).includes(syntheticToken))
    assert.equal(git(cwd, 'write-tree'), staged)
    assert.equal(readFileSync(join(cwd, 'docs/note.md'), 'utf8'), content)
  }
})

test('Markdown moves out of docs and non-Markdown files do not inherit the pre-commit exemption', t => {
  for (const file of ['README.md', 'src/guide.md', 'docs/data.json', 'docs/example.mdx', 'docs/example.MD']) {
    const cwd = fixture(t)
    commitFile(cwd, 'docs/source.md', 'initial\n')
    mkdirSync(dirname(join(cwd, file)), { recursive: true })
    git(cwd, 'mv', 'docs/source.md', file)
    const result = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'pre-commit'], cwd)
    assert.equal(result.status, 1, file)
    assert.match(result.stderr, /Gitleaks is missing/, file)
  }
  const cwd = fixture(t)
  installScanner(cwd)
  commitFile(cwd, 'docs/source.md', 'initial\n')
  git(cwd, 'rm', 'docs/source.md')
  const deletion = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'pre-commit'], cwd)
  assert.equal(deletion.status, 0, deletion.stdout + deletion.stderr)
})

test('CI classifies complete PR changes and exact push revisions rather than only the latest commit', t => {
  const cwd = fixture(t)
  const base = commitFile(cwd, 'src/PocketLedger.Domain/Money.cs', 'class Money {}\n')
  git(cwd, 'update-ref', 'refs/remotes/origin/main', base)
  const docs = commitFile(cwd, 'docs/example.md', 'a note\n')
  const eventPath = join(cwd, 'event.json')
  const classify = (eventName, event) => {
    writeFileSync(eventPath, JSON.stringify(event))
    return execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'ci-scope'], cwd,
      { env: { ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: eventPath } })
  }
  const check = (eventName, event, expected, upgrade = false) => {
    const result = classify(eventName, event)
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.equal(result.stdout.trim(), `run_application_checks=${expected}\nrun_upgrade_checks=${upgrade}`)
  }
  check('push', { ref: 'refs/heads/docs', before: base, after: docs }, false)
  check('push', { ref: 'refs/heads/docs', before: zeroId, after: docs }, false)
  check('pull_request', { pull_request: { base: { sha: base }, head: { sha: docs } } }, false)
  const code = commitFile(cwd, 'src/PocketLedger.Domain/Money.cs', 'class Money { }\n')
  const lastDocs = commitFile(cwd, 'docs/example.md', 'another note\n')
  check('push', { ref: 'refs/heads/docs', before: code, after: lastDocs }, false)
  check('pull_request', { pull_request: { base: { sha: base }, head: { sha: lastDocs } } }, true)
  check('push', { ref: 'refs/heads/docs', before: 'a'.repeat(40), after: docs }, false)
  check('push', { ref: 'refs/heads/feature', before: base, after: code }, false)
  check('push', { ref: 'refs/heads/main', before: base, after: docs }, true)
  check('push', { ref: 'refs/heads/main', before: base, after: code }, true)
  check('push', { ref: 'refs/tags/v1', before: base, after: docs }, true, true)
  const auth = commitFile(cwd, 'infra/keycloak/example.json', '{}\n')
  check('pull_request', { pull_request: { base: { sha: base }, head: { sha: auth } } }, true, true)
  check('push', { ref: 'refs/heads/main', before: lastDocs, after: auth }, true, true)
  check('push', { ref: 'refs/heads/main', before: zeroId, after: auth }, true, true)
  check('push', { ref: 'refs/heads/main', before: 'a'.repeat(40), after: auth }, true, true)
  check('workflow_dispatch', {}, true, true)
  const account = commitFile(cwd, 'src/PocketLedger.Infrastructure/Expenses/CurrentAccount.cs', 'class CurrentAccount {}\n')
  check('pull_request', { pull_request: { base: { sha: auth }, head: { sha: account } } }, true, true)
  check('push', { ref: 'refs/heads/main', before: auth, after: account }, true, true)
  assert.notEqual(classify('pull_request', { pull_request: { base: { sha: 'invalid' }, head: { sha: docs } } }).status, 0)
})

test('CI always reports hygiene and stable checks while gating expensive jobs and matrix steps', () => {
  const workflow = readFileSync(join(root, '.github/workflows/verify.yml'), 'utf8')
  assert.doesNotMatch(workflow, /paths-ignore:/)
  assert.match(workflow, /^  push:$/m)
  assert.match(workflow, /^  pull_request:$/m)
  const jobs = Object.fromEntries([...workflow.matchAll(/^  ([a-z][a-z0-9-]*):\n([\s\S]*?)(?=^  [a-z][a-z0-9-]*:\n|$(?![\s\S]))/gm)]
    .map(match => [match[1], match[2]]))
  assert.match(jobs.hygiene, /ci-scope/)
  assert.match(jobs.hygiene, /run_application_checks: \$\{\{ steps.scope.outputs.run_application_checks \}\}/)
  for (const command of ['node scripts/install-gitleaks.mjs', 'npm run check:hygiene']) {
    assert.ok(jobs.hygiene.includes(`      - run: ${command}\n`), command)
  }
  for (const name of ['backend', 'frontend', 'coverage']) {
    assert.match(jobs[name], /needs: hygiene/)
    assert.match(jobs[name], /^    if: needs.hygiene.outputs.run_application_checks == 'true'$/m)
  }
  assert.match(jobs['authentication-e2e'], /realm-baseline: \[current, phase1\]/)
  assert.match(jobs['authentication-e2e'], /^    if: needs.hygiene.outputs.run_application_checks == 'true' \|\| github.event_name == 'pull_request'$/m)
  for (const step of jobs['authentication-e2e'].split(/^      - /m).slice(1)) {
    assert.match(step, /if: env.RUN_AUTHENTICATION_E2E == '(?:true|false)'/)
  }
})

test('pre-push rejects committed whitespace and secrets without application checks', t => {
  const syntheticToken = `ghp_${randomBytes(18).toString('hex')}`
  for (const content of ['trailing whitespace  \n', `token = "${syntheticToken}"\n`, `token = "${syntheticToken}"  \n`]) {
    const cwd = fixture(t)
    installScanner(cwd)
    const base = commitFile(cwd, 'src/PocketLedger.Domain/Money.cs', 'class Money {}\n')
    git(cwd, 'update-ref', 'refs/remotes/origin/main', base)
    const docs = commitFile(cwd, 'docs/example.md', content)
    const input = `refs/heads/docs ${docs} refs/heads/docs ${zeroId}\n`
    const failure = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'pre-push'], cwd, { input })
    assert.equal(failure.status, 1, failure.stdout + failure.stderr)
    assert.doesNotMatch(failure.stdout, /> (?:node|dotnet|npm) /)
    assert.ok(!(failure.stdout + failure.stderr).includes(syntheticToken))
  }
})

test('manual and CI hygiene redact secrets before whitespace diagnostics', t => {
  const cwd = fixture(t)
  installScanner(cwd)
  const syntheticToken = `ghp_${randomBytes(18).toString('hex')}`
  commitFile(cwd, 'docs/example.md', `token = "${syntheticToken}"  \n`)
  const result = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'hygiene'], cwd)
  assert.equal(result.status, 1)
  assert.ok(!(result.stdout + result.stderr).includes(syntheticToken))
})

test('manual and CI hygiene retain secret scanning on other Git refs', t => {
  const cwd = fixture(t)
  installScanner(cwd)
  commitFile(cwd, 'docs/example.md', 'safe documentation\n')
  git(cwd, 'switch', '-c', 'other-ref')
  const syntheticToken = `ghp_${randomBytes(18).toString('hex')}`
  commitFile(cwd, 'docs/example.md', `token = "${syntheticToken}"\n`)
  git(cwd, 'switch', 'main')
  const result = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'hygiene'], cwd)
  assert.equal(result.status, 1)
  assert.match(result.stdout + result.stderr, /leaks found/)
  assert.ok(!(result.stdout + result.stderr).includes(syntheticToken))
})

test('the configured pre-push hook forwards refs even when the current branch has no push-file diff', t => {
  const cwd = fixture(t)
  copyFileSync(join(root, 'lefthook.yml'), join(cwd, 'lefthook.yml'))
  mkdirSync(join(cwd, '.lefthook/pre-push'), { recursive: true })
  copyFileSync(join(root, '.lefthook/pre-push/verify.sh'), join(cwd, '.lefthook/pre-push/verify.sh'))
  mkdirSync(join(cwd, 'scripts'))
  // Observe the protocol at the dispatcher boundary, without running expensive area checks.
  writeFileSync(join(cwd, 'scripts/checks.mjs'), `
import { readFileSync, writeFileSync } from 'node:fs'
writeFileSync('received.txt', readFileSync(0, 'utf8'))
`)
  const first = commitFile(cwd, 'docs/example.md', 'initial\n')
  // Make the current branch identical to its upstream: other refs must still be forwarded.
  git(cwd, 'update-ref', 'refs/remotes/origin/main', first)
  git(cwd, 'config', 'branch.main.remote', 'origin')
  git(cwd, 'config', 'branch.main.merge', 'refs/heads/main')
  git(cwd, 'config', 'remote.origin.url', cwd)
  git(cwd, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*')
  const input = `refs/heads/another ${first} refs/heads/another ${zeroId}\n`
  const result = execute(process.execPath,
    [resolve(root, 'node_modules/lefthook/bin/index.js'), 'run', 'pre-push', '--no-tty'], cwd,
    { input, env: { ...process.env, LEFTHOOK: '1', LEFTHOOK_BIN: resolve(root, 'node_modules/.bin/lefthook') } })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.equal(readFileSync(join(cwd, 'received.txt'), 'utf8'), input)
})

test('the shell wrapper retains LF in a Windows-style autocrlf checkout', t => {
  const cwd = fixture(t)
  commitFile(cwd, '.gitattributes', readFileSync(join(root, '.gitattributes'), 'utf8'))
  git(cwd, 'config', 'core.autocrlf', 'true')
  const wrapper = '.lefthook/pre-push/verify.sh'
  commitFile(cwd, wrapper, readFileSync(join(root, wrapper), 'utf8'))
  rmSync(join(cwd, wrapper))
  git(cwd, 'checkout', '--', wrapper)
  assert.ok(!readFileSync(join(cwd, wrapper), 'utf8').includes('\r'))
  assert.match(git(cwd, 'check-attr', 'eol', '--', wrapper), /eol: lf$/)
})

test('pre-push validates all refs and checks a committed source deletion without building', t => {
  const cwd = fixture(t)
  installScanner(cwd)
  const first = commitFile(cwd, 'src/PocketLedger.Domain/Removed.cs', 'class Removed {}\n')
  git(cwd, 'rm', 'src/PocketLedger.Domain/Removed.cs')
  git(cwd, 'commit', '-m', 'Remove fixture')
  const second = git(cwd, 'rev-parse', 'HEAD')
  const input = `refs/heads/main ${second} refs/heads/main ${first}\n`
  assert.deepEqual(pushedCommits(input, cwd), [second])
  const result = execute(process.execPath, [join(root, 'scripts/checks.mjs'), 'pre-push'], cwd, { input })
  assert.doesNotMatch(result.stdout, /> (?:node|dotnet|npm) /)
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.throws(() => pushedCommits('malformed\n', cwd), /Invalid Git pre-push/)
})

test('Git hygiene checks reject staged whitespace and conflict markers without changing the index', t => {
  const cwd = fixture(t)
  commitFile(cwd, 'example.txt', 'original\n')
  for (const content of ['trailing whitespace  \n', '<<<<<<< ours\nours\n=======\ntheirs\n>>>>>>> theirs\n']) {
    writeFileSync(join(cwd, 'example.txt'), content)
    git(cwd, 'add', 'example.txt')
    const before = git(cwd, 'write-tree')
    assert.notEqual(execute('git', ['diff', '--cached', '--check'], cwd).status, 0)
    assert.equal(git(cwd, 'write-tree'), before)
    assert.equal(readFileSync(join(cwd, 'example.txt'), 'utf8'), content)
  }
})

test('pinned Lefthook checks staged content and restores unstaged edits on both success and failure', t => {
  const cwd = fixture(t)
  // Exercise the real manager's guard without invoking .NET or changing this checkout's index.
  writeFileSync(join(cwd, 'lefthook.yml'), 'pre-commit:\n  jobs:\n    - run: node guard.mjs\n')
  writeFileSync(join(cwd, 'guard.mjs'), `
import { readFileSync } from 'node:fs'
const content = readFileSync('source with spaces.ts', 'utf8')
if (content.includes('UNSTAGED')) throw new Error('Unstaged content leaked into the check')
if (content.includes('FAIL')) process.exitCode = 1
`)
  commitFile(cwd, 'source with spaces.ts', 'original\n')
  const cli = resolve(root, 'node_modules/lefthook/bin/index.js')
  for (const staged of ['PASS\n', 'FAIL\n']) {
    writeFileSync(join(cwd, 'source with spaces.ts'), staged)
    git(cwd, 'add', 'source with spaces.ts')
    const worktree = `${staged}UNSTAGED\n`
    writeFileSync(join(cwd, 'source with spaces.ts'), worktree)
    const before = git(cwd, 'write-tree')
    const result = execute(process.execPath, [cli, 'run', 'pre-commit', '--no-tty'], cwd,
      { env: { ...process.env, LEFTHOOK: '1' } })
    assert.equal(result.status, staged.startsWith('PASS') ? 0 : 1, result.stdout + result.stderr)
    assert.equal(git(cwd, 'write-tree'), before)
    assert.equal(readFileSync(join(cwd, 'source with spaces.ts'), 'utf8'), worktree)
    assert.equal(git(cwd, 'stash', 'list'), '')
  }
})

test('the actual staged dispatcher accepts clean content and rejects a generated secret with redacted output', t => {
  const cwd = fixture(t)
  commitFile(cwd, 'example.txt', 'original\n')
  mkdirSync(join(cwd, 'scripts'))
  for (const file of ['checks.mjs', 'tool-versions.json']) {
    copyFileSync(join(root, 'scripts', file), join(cwd, 'scripts', file))
  }
  const { gitleaks } = JSON.parse(readFileSync(join(root, 'scripts/tool-versions.json'), 'utf8'))
  const binary = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks'
  const relativeDirectory = `.tools/gitleaks-${gitleaks.version}`
  mkdirSync(join(cwd, relativeDirectory), { recursive: true })
  copyFileSync(join(root, relativeDirectory, binary), join(cwd, relativeDirectory, binary))
  writeFileSync(join(cwd, 'example.txt'), 'safe staged content\n')
  git(cwd, 'add', 'example.txt')
  const success = execute(process.execPath, ['scripts/checks.mjs', 'pre-commit'], cwd)
  assert.equal(success.status, 0, success.stdout + success.stderr)
  // This is a synthetic token created only in a disposable repository, never a credential.
  const syntheticToken = `ghp_${randomBytes(18).toString('hex')}`
  writeFileSync(join(cwd, 'example.txt'), `token = "${syntheticToken}"\n`)
  git(cwd, 'add', 'example.txt')
  const before = git(cwd, 'write-tree')
  const failure = execute(process.execPath, ['scripts/checks.mjs', 'pre-commit'], cwd)
  assert.equal(failure.status, 1)
  assert.match(failure.stdout + failure.stderr, /leaks found/)
  assert.ok(!(failure.stdout + failure.stderr).includes(syntheticToken))
  assert.equal(git(cwd, 'write-tree'), before)
})
