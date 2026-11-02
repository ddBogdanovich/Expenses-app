import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { affectedAreas, pushedFiles } from './checks.mjs'

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

test('documentation skips builds, while shared policies and dependency changes select relevant checks', () => {
  assert.deepEqual(affectedAreas(['docs/learning/example.md', 'README.md']), { backend: false, frontend: false })
  assert.deepEqual(affectedAreas(['src/PocketLedger.Web/package-lock.json']), { backend: false, frontend: true })
  assert.deepEqual(affectedAreas(['Directory.Packages.props']), { backend: true, frontend: false })
  assert.deepEqual(affectedAreas(['.editorconfig']), { backend: true, frontend: true })
  assert.deepEqual(affectedAreas(['scripts/checks.mjs']), { backend: true, frontend: true })
})

test('push selection handles new branches, deleted refs, multiple refs and filenames containing spaces', t => {
  const cwd = fixture(t)
  const first = commitFile(cwd, 'src/PocketLedger.Web/source with spaces.ts', 'export const first = 1\n')
  const second = commitFile(cwd, 'Directory.Packages.props', '<Project />\n')
  const update = `refs/heads/main ${second} refs/heads/main ${first}\n`
  assert.deepEqual(pushedFiles(update, cwd), ['Directory.Packages.props'])
  const creation = `refs/heads/new ${first} refs/heads/new ${zeroId}\n`
  assert.deepEqual(pushedFiles(creation, cwd), ['src/PocketLedger.Web/source with spaces.ts'])
  const deletion = `(delete) ${zeroId} refs/heads/old ${first}\n`
  assert.deepEqual(pushedFiles(deletion, cwd), [])
  assert.deepEqual(new Set(pushedFiles(update + creation + deletion, cwd)),
    new Set(['Directory.Packages.props', 'src/PocketLedger.Web/source with spaces.ts']))
  const missingRemote = `refs/heads/main ${second} refs/heads/main ${'a'.repeat(40)}\n`
  assert.deepEqual(new Set(pushedFiles(missingRemote, cwd)), new Set(git(cwd, 'ls-files').split('\n')))
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

test('deleting a source file still triggers verification and invalid push input fails', t => {
  const cwd = fixture(t)
  const first = commitFile(cwd, 'src/PocketLedger.Domain/Removed.cs', 'class Removed {}\n')
  git(cwd, 'rm', 'src/PocketLedger.Domain/Removed.cs')
  git(cwd, 'commit', '-m', 'Remove fixture')
  const second = git(cwd, 'rev-parse', 'HEAD')
  assert.equal(affectedAreas(pushedFiles(`refs/heads/main ${second} refs/heads/main ${first}\n`, cwd)).backend, true)
  assert.throws(() => pushedFiles('malformed\n', cwd), /Invalid Git pre-push/)
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
