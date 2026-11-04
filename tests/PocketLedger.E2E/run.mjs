import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, open } from 'node:fs/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { GenericContainer, Wait } from 'testcontainers'

const root = fileURLToPath(new URL('../../', import.meta.url))
const artifacts = `${root}.artifacts/e2e`
const processes = []
const containers = []
await mkdir(artifacts, { recursive: true })
async function port() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const result = server.address().port
  await new Promise(resolve => server.close(resolve))
  return result
}
async function start(command, args, env, name) {
  const log = await open(`${artifacts}/${name}.log`, 'w')
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', log.fd, log.fd] })
  processes.push(child)
  return child
}
async function ready(url, child) {
  const timeout = Date.now() + 120_000
  while (Date.now() < timeout) {
    if (child.exitCode !== null) throw new Error(`Service exited before readiness; inspect ignored ${artifacts}`)
    try { if ((await fetch(url)).ok) return } catch { /* Startup is not yet complete. */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Service readiness timed out; inspect ignored ${artifacts}`)
}
try {
  const password = randomBytes(32).toString('hex')
  const postgres = await new GenericContainer('postgres:17-alpine')
    .withEnvironment({ POSTGRES_PASSWORD: password, POSTGRES_DB: 'expenses' })
    .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2)).start()
  containers.push(postgres)
  const apiPort = await port()
  const webPort = await port()
  const baseURL = `http://localhost:${webPort}`
  const api = await start('dotnet', ['run', '--project', 'src/PocketLedger.Api', '--no-launch-profile', '--artifacts-path', '.artifacts/e2e/build'], {
    ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: `http://localhost:${apiPort}`,
    ConnectionStrings__expenses: `Host=${postgres.getHost()};Port=${postgres.getMappedPort(5432)};Username=postgres;Password=${password};Database=expenses`,
    Jwt__SigningKey: randomBytes(64).toString('base64'),
    Logging__LogLevel__Microsoft: 'Warning',
  }, 'api')
  await ready(`http://localhost:${apiPort}/api/alive`, api)
  const web = await start('npm', ['--prefix', 'src/PocketLedger.Web', 'run', 'dev', '--', '--host', 'localhost', '--port', `${webPort}`, '--strictPort'], {
    API_BASE_URL: `http://localhost:${apiPort}`,
  }, 'web')
  await ready(baseURL, web)
  const test = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
    cwd: fileURLToPath(new URL('.', import.meta.url)), env: { ...process.env, E2E_BASE_URL: baseURL }, stdio: 'inherit',
  })
  process.exitCode = await new Promise(resolve => test.on('exit', code => resolve(code ?? 1)))
} finally {
  for (const child of processes.reverse()) child.kill('SIGTERM')
  for (const container of containers.reverse()) await container.stop()
}
