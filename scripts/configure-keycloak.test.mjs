import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import test from 'node:test'

async function fixture(t, initialClient, authenticated = true) {
  const writes = []
  const requests = []
  const server = createServer(async (request, response) => {
    requests.push(request.url)
    response.setHeader('Content-Type', 'application/json')
    if (request.url.includes('/token')) {
      response.writeHead(authenticated ? 200 : 401).end(JSON.stringify({ access_token: 'fixture-token' }))
    } else if (request.method === 'GET') response.end(JSON.stringify([initialClient]))
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
  id: 'ledger-client', secret: 'existing-secret', otherSetting: 'keep',
  redirectUris: ['http://localhost:5173/api/auth/preview/callback'],
  attributes: { 'post.logout.redirect.uris': 'http://localhost:5173/api/auth/preview/signed-out', otherAttribute: 'keep' },
}

test('identity URL reconciliation is idempotent and makes no user or credential writes', async t => {
  const result = await fixture(t, current)
  assert.equal(result.code, 0)
  assert.deepEqual(result.writes, [])
  assert.ok(result.requests.every(path => !path.includes('/users')))
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
