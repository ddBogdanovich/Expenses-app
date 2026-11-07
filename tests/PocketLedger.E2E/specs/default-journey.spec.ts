import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

const sessionHeaders = { 'X-PocketLedger-Auth': 'preview' }

async function login(page: Page, destination = '/') {
  await page.goto(destination)
  await expect(page.getByLabel('Email address', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/realms\/pocketledger\//)
  await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
}

test('default registration uses only hosted credentials and preserves confirmation', async ({ page }) => {
  const credentialPosts: string[] = []
  page.on('request', request => {
    if (request.method() === 'POST' && request.postData()?.includes('password')) credentialPosts.push(request.url())
  })
  await page.goto('/register')
  await expect(page).toHaveURL(/\/realms\/pocketledger\//)
  await expect(page.locator('#kc-register-form')).toBeVisible()
  const email = `default-${randomUUID()}@example.com`
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(`Valid-${randomUUID()}`)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toBeVisible()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View today’s spending' }).click()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  expect(credentialPosts.length).toBeGreaterThan(0)
  expect(credentialPosts.every(url => new URL(url).origin === new URL(process.env.E2E_AUTHORITY!).origin)).toBe(true)
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} })
})

test('default login restores reload and revisit and logout prevents Back/reload disclosure', async ({ page, context }) => {
  await login(page, '/login')
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  const identity = await (await context.request.get('/api/auth/me', { headers: sessionHeaders })).json()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  expect(await (await context.request.get('/api/auth/me', { headers: sessionHeaders })).json()).toEqual(identity)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.getByRole('button', { name: /^(Yes|Log out)$/ }).click()
  await expect(page.getByRole('heading', { name: 'You’re logged out.' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toHaveCount(0)
  expect((await context.request.get('/api/auth/me', { headers: sessionHeaders })).status()).toBe(401)
})

test('development reference returns through hosted login and expiration hides examples', async ({ page, context }) => {
  await login(page, '/design-system')
  await expect(page.getByText('DESIGN REFERENCE · DEVELOPMENT ONLY')).toBeVisible()
  await page.reload()
  await expect(page.getByText('DESIGN REFERENCE · DEVELOPMENT ONLY')).toBeVisible()
  expect((await context.request.post(`${process.env.E2E_CONTROL_URL}/expire-sessions`, {
    headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! },
  })).status()).toBe(204)
  await page.reload()
  await expect(page.getByText(/Your session has ended/)).toBeVisible()
  await expect(page.getByText('DESIGN REFERENCE · DEVELOPMENT ONLY')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible()
})

test('browser callback failures present bounded accessible recovery without automatic retries', async ({ page }) => {
  await page.goto('/api/auth/preview/callback?code=invalid&state=invalid')
  await expect(page.getByRole('heading', { name: 'We couldn’t complete login.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Try again', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/auth\/recovery\?code=auth.callback_failed/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'We couldn’t complete login.' })).toBeVisible()
})

test('provider outage offers explicit retry and return without a redirect loop', async ({ page, context }) => {
  const control = async (action: string) => {
    expect((await context.request.post(`${process.env.E2E_CONTROL_URL}/${action}`, {
      headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! },
    })).status()).toBe(204)
  }
  await control('provider-offline')
  try {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Login is temporarily unavailable.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Try again', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Login is temporarily unavailable.' })).toBeVisible()
  } finally { await control('provider-online') }
  await page.getByRole('link', { name: 'Try again', exact: true }).click()
  await expect(page).toHaveURL(/\/realms\/pocketledger\//)
})

test('cancelled and expired real transactions offer a new attempt without disclosing callback data', async ({ page, context }) => {
  for (const expired of [false, true]) {
    await context.clearCookies()
    let callback = ''
    await page.route('**/realms/pocketledger/**', async route => {
      if (!route.request().isNavigationRequest()) { await route.continue(); return }
      const response = await route.fetch({ maxRedirects: 0 })
      const location = response.headers().location
      if (location && new URL(location, response.url()).pathname === '/api/auth/preview/callback') {
        callback = new URL(location, response.url()).href
        await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Transaction captured.</p>' })
      } else await route.fulfill({ response })
    })
    await page.goto('/api/auth/preview/start?returnUrl=/')
    await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
    await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect.poll(() => callback.length).toBeGreaterThan(0)
    await page.unroute('**/realms/pocketledger/**')
    if (expired) await context.clearCookies({ name: /Correlation/ })
    const query = new URLSearchParams({ error: 'access_denied', error_description: 'sensitive-description', state: new URL(callback).searchParams.get('state')! })
    await page.goto(`/api/auth/preview/callback?${query}`)
    await expect(page.getByRole('heading', { name: expired ? 'Your login attempt has expired.' : 'Login was cancelled.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Try again', exact: true })).toBeVisible()
    expect(page.url()).not.toContain('sensitive-description')
    expect((await context.request.get('/api/auth/me', { headers: sessionHeaders })).status()).toBe(401)
  }
})

test('logout still ends provider SSO when the local session has expired just before the click', async ({ page, context }) => {
  await login(page, '/login')
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  expect((await context.request.post(`${process.env.E2E_CONTROL_URL}/expire-sessions`, {
    headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! },
  })).status()).toBe(204)
  await page.getByRole('button', { name: 'Log out', exact: true }).click()
  await page.getByRole('button', { name: /^(Yes|Log out)$/ }).click()
  await expect(page.getByRole('heading', { name: 'You’re logged out.' })).toBeVisible()
  await page.getByRole('link', { name: 'Log in', exact: true }).click()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
})
