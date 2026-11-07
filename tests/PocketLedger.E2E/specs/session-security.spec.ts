import { createHash, randomBytes } from 'node:crypto'
import { expect, test } from '@playwright/test'

const previewHeaders = { 'X-PocketLedger-Auth': 'preview' }

async function captureCallback(page: import('@playwright/test').Page, path = '/api/auth/preview/callback') {
  let callback = ''
  // Intercept the provider response that issues the redirect. Playwright routing
  // cannot stop a later hop in an already-followed HTTP redirect chain.
  await page.route('**/realms/pocketledger/**', async route => {
    if (!route.request().isNavigationRequest()) { await route.continue(); return }
    const response = await route.fetch({ maxRedirects: 0 })
    const location = response.headers().location
    if (location && new URL(location, response.url()).pathname === path) {
      callback = new URL(location, response.url()).href
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Callback captured by the security test.</p>' })
    } else await route.fulfill({ response })
  })
  return () => callback
}


async function login(page: import('@playwright/test').Page) {
  await page.goto('/api/auth/preview/start')
  await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
}

test('real authorization callback is single use and protected responses are not cached', async ({ page, context }) => {
  const captured = await captureCallback(page)
  await page.goto('/api/auth/preview/start')
  await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect.poll(() => captured().length).toBeGreaterThan(0)
  const callback = captured()
  const first = await context.request.get(callback, { maxRedirects: 0 })
  expect(first.status()).toBe(302)
  expect(first.headers()['cache-control']).toContain('no-store')
  const replay = await context.request.get(callback, { maxRedirects: 0 })
  expect(replay.status()).toBe(400)
  expect((await replay.json()).code).toBe('auth.transaction_expired')
  const me = await context.request.get('/api/auth/me', { headers: previewHeaders })
  expect(me.status()).toBe(200)
  expect(me.headers()['cache-control']).toContain('no-store')
})

test('provider cancellation and missing correlation return bounded backend contracts', async ({ page, context }) => {
  for (const expired of [false, true]) {
    await context.clearCookies()
    const captured = await captureCallback(page)
    await page.goto('/api/auth/preview/start')
    await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect.poll(() => captured().length).toBeGreaterThan(0)
    const original = new URL(captured())
    const callback = `/api/auth/preview/callback?error=access_denied&error_description=sensitive-description&state=${encodeURIComponent(original.searchParams.get('state')!)}`
    if (expired) await context.clearCookies({ name: /Correlation/ })
    await page.unroute('**/realms/pocketledger/**')
    const failed = await context.request.get(callback, { maxRedirects: 0 })
    expect(failed.status()).toBe(400)
    expect(failed.headers().location).toBeUndefined()
    expect((await failed.json()).code).toBe(expired ? 'auth.transaction_expired' : 'auth.cancelled')
    expect((await context.request.get('/api/auth/me', { headers: previewHeaders })).status()).toBe(401)
  }
})

test('idle expiration rejects a previously working real browser session', async ({ page, context }) => {
  await login(page)
  const expired = await context.request.post(`${process.env.E2E_CONTROL_URL}/expire-sessions`, {
    headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! },
  })
  expect(expired.status()).toBe(204)
  const me = await context.request.get('/api/auth/me', { headers: previewHeaders })
  expect(me.status()).toBe(401)
  expect(me.headers().location).toBeUndefined()
  expect(me.headers()['cache-control']).toContain('no-store')
})

test('provider HTTP outage bounds new authentication and code exchange while local sessions remain usable', async ({ page, context, browser }) => {
  const control = async (action: string) => {
    const response = await context.request.post(`${process.env.E2E_CONTROL_URL}/${action}`, {
      headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! },
    })
    expect(response.status()).toBe(204)
  }
  await login(page)
  const markers: string[] = []
  const unauthenticated = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    await control('provider-offline')
    const start = await unauthenticated.request.get('/api/auth/preview/start', { maxRedirects: 0 })
    expect(start.status()).toBe(503)
    expect((await start.json()).code).toBe('auth.provider_unavailable')
    expect((await context.request.get('/api/auth/me', { headers: previewHeaders })).status()).toBe(200)
    await control('provider-online')
    const freshPage = await unauthenticated.newPage()
    const captured = await captureCallback(freshPage)
    await freshPage.goto('/api/auth/preview/start')
    await freshPage.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
    await freshPage.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
    await freshPage.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect.poll(() => captured().length).toBeGreaterThan(0)
    const callback = captured()
    markers.push(new URL(callback).searchParams.get('code')!, new URL(callback).searchParams.get('state')!)
    await control('provider-offline')
    const failed = await unauthenticated.request.get(callback, { maxRedirects: 0 })
    expect(failed.status()).toBe(503)
    expect((await failed.json()).code).toBe('auth.provider_unavailable')
    expect((await unauthenticated.request.get('/api/auth/me', { headers: previewHeaders })).status()).toBe(401)
    markers.push(...(await context.cookies()).filter(cookie => cookie.name === 'PocketLedger.Preview').map(cookie => cookie.value))
    const csrf = await (await context.request.get('/api/auth/preview/antiforgery')).json()
    const logout = await context.request.post('/api/auth/preview/logout', {
      headers: { 'X-CSRF-TOKEN': csrf.requestToken }, maxRedirects: 0,
    })
    expect(logout.status()).toBe(302)
    expect((await context.request.get('/api/auth/me', { headers: previewHeaders })).status()).toBe(401)
  } finally {
    await control('provider-online')
    await unauthenticated.close()
  }
  markers.push(...(await context.cookies()).filter(cookie => cookie.name === 'PocketLedger.Preview').map(cookie => cookie.value))
  const auditTraceId = randomBytes(16).toString('hex')
  const invalid = await context.request.get('/api/auth/preview/callback?code=sensitive-code&state=sensitive-state', {
    maxRedirects: 0, headers: { traceparent: `00-${auditTraceId}-${randomBytes(8).toString('hex')}-01` },
  })
  expect(invalid.status()).toBe(400)
  await expect.poll(async () => {
    const audit = await context.request.post(`${process.env.E2E_CONTROL_URL}/audit-auth-logs`, {
      headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! }, data: { markers, afterTraceId: auditTraceId },
    })
    return audit.json()
  }).toEqual({ clean: true, callbackTraceObserved: true })
})


test('real provider rejects a wrong PKCE verifier and ID tokens cannot authenticate API requests', async ({ page, context }) => {
  const redirect = `${process.env.E2E_BASE_URL}/security-test/callback`
  for (const wrongVerifier of [true, false]) {
    await page.unroute('**/realms/pocketledger/**')
    const captured = await captureCallback(page, '/security-test/callback')
    const verifier = randomBytes(32).toString('base64url')
    const query = new URLSearchParams({ client_id: 'pocketledger-security-test', response_type: 'code',
      scope: 'openid email', redirect_uri: redirect, state: randomBytes(16).toString('hex'),
      nonce: randomBytes(16).toString('hex'), code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url') })
    await page.goto(`${process.env.E2E_AUTHORITY}/protocol/openid-connect/auth?${query}`)
    if (!captured()) {
      await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
      await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
      await page.getByRole('button', { name: 'Log in', exact: true }).click()
    }
    await expect.poll(() => captured().length).toBeGreaterThan(0)
    const token = await context.request.post(`${process.env.E2E_AUTHORITY}/protocol/openid-connect/token`, {
      form: { client_id: 'pocketledger-security-test', grant_type: 'authorization_code', redirect_uri: redirect,
        code: new URL(captured()).searchParams.get('code')!, code_verifier: wrongVerifier ? randomBytes(32).toString('base64url') : verifier },
    })
    if (wrongVerifier) {
      expect(token.status()).toBe(400)
      expect((await token.json()).error).toBe('invalid_grant')
    } else {
      expect(token.status()).toBe(200)
      const { id_token } = await token.json()
      expect(typeof id_token).toBe('string')
      for (const selection of [{}, previewHeaders]) {
        const rejected = await context.request.get('/api/auth/me', { headers: { ...selection, Authorization: `Bearer ${id_token}` } })
        expect(rejected.status()).toBe(401)
      }
    }
  }
})
