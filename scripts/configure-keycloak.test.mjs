import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const template = JSON.parse(await readFile(new URL('../infra/keycloak/pocketledger-realm.json', import.meta.url)))
const profile = JSON.parse(template.components['org.keycloak.userprofile.UserProfileProvider'][0].config['kc.user.profile.config'][0])
const flows = template.authenticationFlows
const executions = [{ id: 'form', displayName: flows[1].alias, requirement: 'REQUIRED' },
  ...flows[1].authenticationExecutions.map((entry, index) => ({ id: `action-${index}`, providerId: entry.authenticator, requirement: 'REQUIRED' }))]

const confirmation = { alias: 'pocketledger-registration-confirmation', providerId: 'pocketledger-registration-confirmation',
  name: 'PocketLedger registration confirmation', enabled: true, defaultAction: false, priority: 0 }

async function fixture(t, initialClient, authenticated = true, requiredActions = [confirmation]) {
  const writes = []
  const requests = []
  const server = createServer(async (request, response) => {
    requests.push(request.url)
    response.setHeader('Content-Type', 'application/json')
    if (request.url.includes('/token')) {
      response.writeHead(authenticated ? 200 : 401).end(JSON.stringify({ access_token: 'fixture-token' }))
    } else if (request.method === 'GET') {
      const result = request.url.endsWith('/authentication/flows') ? flows.filter(flow => flow.topLevel)
        : request.url.endsWith('/authentication/required-actions') ? requiredActions
        : request.url.endsWith('/executions') ? executions
        : request.url.endsWith('/users/profile') ? profile
        : request.url.endsWith('/realms/pocketledger') ? template : [initialClient]
      response.end(JSON.stringify(result))
    }
    else {
      let body = ''
      for await (const chunk of request) body += chunk
      writes.push(JSON.parse(body))
      response.writeHead(204).end()
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const child = spawn(process.execPath, ['scripts/configure-keycloak.mjs'], {
    env: { ...process.env, KEYCLOAK_URL: `http://127.0.0.1:${server.address().port}`, KEYCLOAK_ADMIN_PASSWORD: 'test-only-password', POCKETLEDGER_WEB_ORIGIN: 'http://localhost:5173' },
    stdio: 'ignore',
  })
  const code = await new Promise(resolve => child.once('exit', resolve))
  return { code, writes, requests }
}

const current = {
  standardFlowEnabled: true, implicitFlowEnabled: false, directAccessGrantsEnabled: false, serviceAccountsEnabled: false,
  id: 'ledger-client', secret: 'existing-secret', otherSetting: 'keep',
  baseUrl: 'http://localhost:5173/api/auth/preview/start',
  redirectUris: ['http://localhost:5173/api/auth/preview/callback'],
  attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': 'http://localhost:5173/api/auth/preview/signed-out', otherAttribute: 'keep' },
}

test('identity URL reconciliation is idempotent and makes no user or credential writes', async t => {
  const result = await fixture(t, current)
  assert.equal(result.code, 0)
  assert.deepEqual(result.writes, [])
  assert.ok(result.requests.every(path => !/\/users(?:\?|$|\/(?!profile))/.test(path)))
})

test('identity URL updates preserve client credentials and unrelated configuration', async t => {
  const result = await fixture(t, { ...current, redirectUris: ['http://old.example/callback'] })
  assert.equal(result.code, 0)
  assert.deepEqual(result.writes, [current])
})

test('failed bootstrap authentication cannot mutate identity configuration', async t => {
  const result = await fixture(t, current, false)
  assert.equal(result.code, 1)
  assert.equal(result.requests.length, 1)
  assert.deepEqual(result.writes, [])
})

// Policy drift must be corrected without replacing credentials or unrelated client attributes.
test('preview cannot retain a password grant or lose PKCE through configuration drift', async t => {
  const result = await fixture(t, { ...current, directAccessGrantsEnabled: true, attributes: { ...current.attributes, 'pkce.code.challenge.method': 'plain' } })
  assert.equal(result.code, 0)
  assert.deepEqual(result.writes, [current])
})

test('registration confirmation is added without changing built-in required actions or accounts', async t => {
  const result = await fixture(t, current, true, [{ alias: 'UPDATE_PASSWORD', enabled: true }])
  assert.equal(result.code, 0)
  assert.deepEqual(result.writes, [{ providerId: confirmation.providerId, name: confirmation.name }, confirmation])
  assert.ok(result.requests.every(path => !/\/users(?:\?|$|\/(?!profile))/.test(path)))
})

test('registration confirmation cannot become a default action for returning users', async t => {
  const result = await fixture(t, current, true, [{ ...confirmation, defaultAction: true }])
  assert.equal(result.code, 0)
  assert.deepEqual(result.writes, [confirmation])
})
