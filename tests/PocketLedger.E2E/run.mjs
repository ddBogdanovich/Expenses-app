import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, open, readFile, writeFile, unlink, cp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import { fileURLToPath } from 'node:url'
import { GenericContainer, Network, Wait } from 'testcontainers'

const root = fileURLToPath(new URL('../../', import.meta.url))
const artifacts = `${root}.artifacts/e2e`
const keyRingDirectory = `${artifacts}/keys-${randomUUID()}`
const frontendDirectory = `${artifacts}/web-${randomUUID()}`
const processes = []
const logs = []
const containers = []
let network
let controlServer
let telemetryReceiver
const tracePayloads = []
let providerProxy
let providerOffline = false
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
  logs.push(log)
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', log.fd, log.fd], detached: process.platform !== 'win32' })
  processes.push(child)
  return child
}
function stop(child) {
  try {
    if (process.platform === 'win32') child.kill('SIGTERM')
    else process.kill(-child.pid, 'SIGTERM')
  } catch (error) { if (error.code !== 'ESRCH') throw error }
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
  await cp(`${root}src/PocketLedger.Web`, frontendDirectory, {
    recursive: true, filter: source => !/(?:^|\/)(?:node_modules|dist|\.vite)(?:\/|$)/.test(source),
  })
  const install = await start('npm', ['--prefix', frontendDirectory, 'ci'], {}, 'web-install')
  if (await new Promise(resolve => install.once('exit', resolve)) !== 0) throw new Error('Isolated frontend dependency install failed.')
  const password = randomBytes(32).toString('hex')
  const postgres = await new GenericContainer('postgres:17-alpine')
    .withEnvironment({ POSTGRES_PASSWORD: password, POSTGRES_DB: 'expenses' })
    .withExposedPorts(5432).withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2)).start()
  containers.push(postgres)
  const apiPort = await port()
  const webPort = await port()
  const baseURL = `http://localhost:${webPort}`
  network = await new Network().start()
  const identityDatabase = await new GenericContainer('postgres:17-alpine')
    .withNetwork(network).withNetworkAliases('identity')
    .withEnvironment({ POSTGRES_PASSWORD: password, POSTGRES_DB: 'keycloak' })
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2)).start()
  containers.push(identityDatabase)
  const clientSecret = randomBytes(32).toString('hex')
  const userPassword = randomBytes(24).toString('hex')
  const subject = '6f48ebfc-cdaa-43df-9f6f-b548876466a3'
  const realmTemplate = process.env.E2E_REALM_BASELINE === 'phase1'
    ? 'tests/PocketLedger.E2E/fixtures/phase1-realm.json' : 'infra/keycloak/pocketledger-realm.json'
  const realm = JSON.parse(await readFile(`${root}${realmTemplate}`, 'utf8'))
  // Test-only public code-flow client proves token confusion/PKCE boundaries without password grants.
  realm.clients.push({ clientId: 'pocketledger-security-test', enabled: true, publicClient: true,
    standardFlowEnabled: true, directAccessGrantsEnabled: false,
    redirectUris: [`${baseURL}/security-test/callback`], defaultClientScopes: ['email', 'profile'],
    attributes: { 'pkce.code.challenge.method': 'S256' } })
  realm.users = [{ id: subject, username: 'preview@example.com', email: 'preview@example.com', enabled: true,
    firstName: 'Preview', lastName: 'Owner', credentials: [{ type: 'password', value: userPassword, temporary: false }] }]
  const keycloak = await new GenericContainer('quay.io/keycloak/keycloak:26.8.1')
    .withNetwork(network)
    .withEnvironment({ KC_BOOTSTRAP_ADMIN_USERNAME: 'admin', KC_BOOTSTRAP_ADMIN_PASSWORD: password,
      KC_DB: 'postgres', KC_DB_URL: 'jdbc:postgresql://identity:5432/keycloak', KC_DB_USERNAME: 'postgres', KC_DB_PASSWORD: password,
      KC_HEALTH_ENABLED: 'true', POCKETLEDGER_CLIENT_SECRET: clientSecret, POCKETLEDGER_WEB_ORIGIN: baseURL })
    .withCopyContentToContainer([{ content: JSON.stringify(realm), target: '/opt/keycloak/data/import/pocketledger-realm.json' }])
    .withBindMounts([
      { source: `${root}.artifacts/keycloak-theme/pocketledger`, target: '/opt/keycloak/themes/pocketledger', mode: 'ro' },
      { source: `${root}.artifacts/keycloak-provider/pocketledger-registration.jar`, target: '/opt/keycloak/providers/pocketledger-registration.jar', mode: 'ro' },
    ])
    .withCommand(['start-dev', '--import-realm', '--spi-theme--cache-themes=false', '--spi-theme--cache-templates=false', '--spi-theme--static-max-age=-1']).withExposedPorts(8080, 9000)
    .withWaitStrategy(Wait.forHttp('/health/ready', 9000).forStatusCode(200)).withStartupTimeout(120_000).start()
  containers.push(keycloak)
  const providerTarget = `http://localhost:${keycloak.getMappedPort(8080)}`
  // A disposable fault switch exercises genuine metadata/PAR/code-exchange HTTP failures.
  providerProxy = createHttpServer((request, response) => {
    if (providerOffline) { response.writeHead(503).end(); return }
    const upstream = httpRequest(new URL(request.url, providerTarget), {
      method: request.method, headers: request.headers,
    }, result => {
      response.writeHead(result.statusCode, result.headers)
      result.pipe(response)
    })
    upstream.on('error', () => response.writeHead(503).end())
    request.pipe(upstream)
  })
  await new Promise(resolve => providerProxy.listen(0, 'localhost', resolve))
  const keycloakURL = `http://localhost:${providerProxy.address().port}`
  // Run the same non-destructive reconciliation as Aspire, twice to verify idempotency.
  for (let attempt = 0; attempt < 2; attempt++) {
    const configuration = await start('node', ['scripts/configure-keycloak.mjs'], {
      KEYCLOAK_URL: keycloakURL, KEYCLOAK_ADMIN_PASSWORD: password, POCKETLEDGER_WEB_ORIGIN: baseURL,
    }, `identity-config-${attempt}`)
    if (await new Promise(resolve => configuration.once('exit', resolve)) !== 0) throw new Error('Identity policy reconciliation failed; inspect ignored configuration logs.')
  }
  const authority = `${keycloakURL}/realms/pocketledger`
  const apiArgs = ['run', '--project', 'src/PocketLedger.Api', '--no-launch-profile', '--artifacts-path', '.artifacts/e2e/build']
  const apiEnvironment = {
    ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: `http://localhost:${apiPort}`,
    ConnectionStrings__expenses: `Host=${postgres.getHost()};Port=${postgres.getMappedPort(5432)};Username=postgres;Password=${password};Database=expenses`,
    Logging__LogLevel__Microsoft: 'Warning',
    Keycloak__Enabled: 'true', Keycloak__Authority: authority, Keycloak__ClientSecret: clientSecret, Keycloak__BrowserOrigin: baseURL,
    Keycloak__KeyRingPath: keyRingDirectory,
  }
  // Receive actual OTLP protobuf exports from the separate API process, avoiding
  // process-global instrumentation races between in-process HTTP test hosts.
  telemetryReceiver = createHttpServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    if (request.url === '/v1/traces') tracePayloads.push(Buffer.concat(chunks))
    response.writeHead(200, { 'Content-Type': 'application/x-protobuf' }).end()
  })
  await new Promise(resolve => telemetryReceiver.listen(0, '127.0.0.1', resolve))
  apiEnvironment.OTEL_EXPORTER_OTLP_ENDPOINT = `http://127.0.0.1:${telemetryReceiver.address().port}`
  apiEnvironment.OTEL_EXPORTER_OTLP_PROTOCOL = 'http/protobuf'
  let api = await start('dotnet', apiArgs, apiEnvironment, 'api')
  await ready(`http://localhost:${apiPort}/api/alive`, api)
  const web = await start('npm', ['--prefix', frontendDirectory, 'run', 'dev', '--', '--host', 'localhost', '--port', `${webPort}`, '--strictPort'], {
    API_BASE_URL: `http://localhost:${apiPort}`,
  }, 'web')
  await ready(baseURL, web)
  const controlToken = randomBytes(32).toString('hex')
  controlServer = createHttpServer(async (request, response) => {
    if (request.method !== 'POST' || !['/restart-api', '/identity-count', '/require-confirmation', '/expire-sessions', '/provider-offline', '/provider-online', '/audit-auth-logs'].includes(request.url) || request.headers['x-e2e-control'] !== controlToken) {
      response.writeHead(404).end(); return
    }
    try {
      if (request.url === '/provider-offline' || request.url === '/provider-online') {
        providerOffline = request.url === '/provider-offline'
        response.writeHead(204).end()
        return
      }
      if (request.url === '/audit-auth-logs') {
        const captured = await readFile(`${artifacts}/api.log`, 'utf8')
        let body = ''
        for await (const chunk of request) body += chunk
        const { markers = [], afterTraceId } = body ? JSON.parse(body) : {}
        const sensitive = [password, userPassword, clientSecret, 'sensitive-description', 'sensitive-code', 'sensitive-state', ...markers]
        const clean = sensitive.every(value => !captured.includes(value) && tracePayloads.every(payload => !payload.includes(Buffer.from(value))))
        // The final request's W3C trace ID is a flush barrier: older unrelated
        // callback spans cannot satisfy the telemetry-presence assertion.
        const callbackTraceObserved = typeof afterTraceId === 'string' && /^[a-f0-9]{32}$/.test(afterTraceId) && tracePayloads.some(payload =>
          payload.includes(Buffer.from(afterTraceId, 'hex')) && payload.includes(Buffer.from('/api/auth/preview/callback')))
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ clean, callbackTraceObserved }))
        return
      }
      if (request.url === '/expire-sessions') {
        const result = await postgres.exec(['psql', '-U', 'postgres', '-d', 'expenses', '-c', `UPDATE "BrowserSessions" SET "ExpiresUtc" = NOW() - INTERVAL '1 minute'`])
        if (result.exitCode !== 0) throw new Error('Session expiry fixture failed.')
        response.writeHead(204).end()
        return
      }
      if (request.url === '/identity-count' || request.url === '/require-confirmation') {
        let body = ''
        for await (const chunk of request) body += chunk
        const { email } = JSON.parse(body)
        const authentication = await fetch(`${keycloakURL}/realms/master/protocol/openid-connect/token`, {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: 'admin', password }),
        })
        if (!authentication.ok) throw new Error('Test administration failed.')
        const { access_token } = await authentication.json()
        const users = await fetch(`${keycloakURL}/admin/realms/pocketledger/users?email=${encodeURIComponent(email.trim().toLowerCase())}&exact=true`, {
          headers: { Authorization: `Bearer ${access_token}` },
        })
        if (!users.ok) throw new Error('Test identity lookup failed.')
        const identities = await users.json()
        if (request.url === '/require-confirmation') {
          // Negative acceptance only: a real, already-created disposable account
          // has no registration transaction note, even if assigned this action.
          if (identities.length !== 1) throw new Error('Expected one test identity.')
          const identity = identities[0]
          const updated = await fetch(`${keycloakURL}/admin/realms/pocketledger/users/${encodeURIComponent(identity.id)}`, {
            method: 'PUT', headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requiredActions: [...(identity.requiredActions ?? []), 'pocketledger-registration-confirmation'] }),
          })
          if (!updated.ok) throw new Error('Test required-action assignment failed.')
          response.writeHead(204).end()
          return
        }
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ count: identities.length }))
        return
      }
      const exited = new Promise(resolve => api.once('exit', resolve))
      stop(api)
      await exited
      api = await start('dotnet', apiArgs, apiEnvironment, 'api')
      await ready(`http://localhost:${apiPort}/api/alive`, api)
      response.writeHead(200).end()
    } catch { response.writeHead(503).end() }
  })
  await new Promise(resolve => controlServer.listen(0, '127.0.0.1', resolve))
  const controlURL = `http://127.0.0.1:${controlServer.address().port}`
  const test = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
    cwd: fileURLToPath(new URL('.', import.meta.url)), env: { ...process.env, E2E_BASE_URL: baseURL, E2E_AUTHORITY: authority, E2E_USER_EMAIL: 'preview@example.com', E2E_USER_PASSWORD: userPassword, E2E_PROVIDER_SUBJECT: subject, E2E_CONTROL_URL: controlURL, E2E_CONTROL_TOKEN: controlToken }, stdio: 'inherit',
  })
  process.exitCode = await new Promise(resolve => test.on('exit', code => resolve(code ?? 1)))
  if (process.env.E2E_INSPECT === '1') {
    await writeFile(`${artifacts}/inspection.json`, JSON.stringify({ pid: process.pid, baseURL, email: 'preview@example.com', password: userPassword, controlURL, controlToken }), { mode: 0o600 })
    console.log(`Disposable inspection stack ready at ${baseURL}; stop with SIGINT after MCP verification.`)
    await new Promise(resolve => process.once('SIGINT', resolve))
  }
} finally {
  if (controlServer) await new Promise(resolve => controlServer.close(resolve))
  if (providerProxy) await new Promise(resolve => providerProxy.close(resolve))
  await unlink(`${artifacts}/inspection.json`).catch(() => {})
  for (const child of processes.reverse()) stop(child)
  if (telemetryReceiver) await new Promise(resolve => telemetryReceiver.close(resolve))
  for (const log of logs) await log.close()
  await rm(frontendDirectory, { recursive: true, force: true })
  await rm(keyRingDirectory, { recursive: true, force: true })
  for (const container of containers.reverse()) await container.stop()
  if (network) await network.stop()
}
