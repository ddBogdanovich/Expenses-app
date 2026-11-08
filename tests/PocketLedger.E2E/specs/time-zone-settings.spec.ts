import { expect, test } from '@playwright/test'

test('saved account time zone survives reload and controls daily summary', async ({ page, context }) => {
  await page.goto('/login')
  await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_USER_EMAIL!)
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  const zone = page.getByRole('combobox', { name: /^Time zone/ })
  await zone.clear()
  await zone.fill('America/Los_Angeles')
  await expect(page.getByRole('option')).toHaveCount(1)
  await page.getByRole('option', { name: 'America/Los_Angeles', exact: true }).click()
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible()
  await zone.fill('Not/A/SupportedZone')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByText('Choose a time zone from the list.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(zone).toHaveValue('America/Los_Angeles')
  await page.getByRole('button', { name: 'Back to today', exact: true }).click()
  const summary = await (await context.request.get('/api/expenses/today')).json()
  expect(summary.timeZone).toBe('America/Los_Angeles')
  await expect(page.locator('time')).toHaveAttribute('datetime', summary.purchaseDate)
  await expect(page.getByText('America/Los_Angeles', { exact: false })).toBeVisible()
})

async function register(page: import('@playwright/test').Page) {
  const email = `zone-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  const password = `Settings-${Date.now()}-${Math.random()}`
  await page.goto('/register')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByRole('button', { name: 'View today’s spending' }).click()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  return { email, password }
}

test('settings cancellation, failed save, pending guard and stale-form recovery retain explicit intent', async ({ page, context }) => {
  await register(page)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const zone = page.getByRole('combobox', { name: /^Time zone/ })
  await zone.fill('Not/A/SupportedZone')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByText('Choose a time zone from the list.', { exact: true })).toBeVisible()
  expect((await (await context.request.get('/api/preferences')).json()).timeZone).toBe('Europe/Warsaw')
  await zone.fill('Pacific/Kiritimati')
  await page.getByRole('option', { name: 'Pacific/Kiritimati', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await (await context.request.get('/api/preferences')).json()).timeZone).toBe('Europe/Warsaw')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await zone.fill('America/Los_Angeles')
  await page.getByRole('option', { name: 'America/Los_Angeles', exact: true }).click()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  let writes = 0
  await page.route('**/api/preferences', async route => {
    if (route.request().method() !== 'PATCH') { await route.continue(); return }
    writes++
    await held
    await route.fulfill({ status: 503, json: {} })
  })
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saving settings…' })).toBeDisabled()
  await expect(zone).toBeDisabled()
  release()
  await expect(page.getByRole('alert')).toContainText('We couldn’t confirm')
  await expect(zone).toHaveValue('America/Los_Angeles')
  expect(writes).toBe(1)
  expect((await (await context.request.get('/api/preferences')).json()).timeZone).toBe('Europe/Warsaw')
  await page.unroute('**/api/preferences')
  const current = await (await context.request.get('/api/preferences')).json()
  const csrf = await (await context.request.get('/api/auth/preview/antiforgery')).json()
  expect((await context.request.patch('/api/preferences', { headers: { 'X-CSRF-TOKEN': csrf.requestToken }, data: { timeZone: 'Pacific/Kiritimati', expectedRevision: current.revision } })).status()).toBe(200)
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Settings changed in another session')
  await page.getByRole('button', { name: 'Reload settings' }).click()
  await expect(zone).toHaveValue('Pacific/Kiritimati')
  await zone.fill('America/Los_Angeles')
  await page.getByRole('option', { name: 'America/Los_Angeles', exact: true }).click()
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible()
})

test('owner settings and exact expense history survive API restart and forged writes are rejected', async ({ browser }) => {
  const owners = await Promise.all([browser.newContext({ timezoneId: 'Asia/Tokyo' }), browser.newContext({ timezoneId: 'America/New_York' })])
  try {
    const pages = await Promise.all(owners.map(owner => owner.newPage()))
    const credentials = []
    for (const page of pages) credentials.push(await register(page))
    const current = await (await owners[0].request.get('/api/preferences')).json()
    expect(current).toMatchObject({ timeZone: 'Europe/Warsaw', defaultCurrency: 'PLN', recentCurrencies: [] })
    const csrf = await (await owners[0].request.get('/api/auth/preview/antiforgery')).json()
    const headers = { 'X-CSRF-TOKEN': csrf.requestToken }
    const purchase = await owners[0].request.post('/api/expenses', { headers, data: { amountGrosz: 1234, purchaseDate: '2026-01-01', category: 'Food', note: 'Preserve exactly', qualifiesForAllowance: false } })
    expect(purchase.status()).toBe(201)
    const history = await (await owners[0].request.get('/api/expenses')).json()
    const forged = await owners[0].request.patch('/api/preferences', { data: { timeZone: 'America/Los_Angeles', expectedRevision: current.revision } })
    expect(forged.status()).toBe(400)
    expect(forged.headers()['cache-control']).toContain('no-store')
    expect((await owners[0].request.patch('/api/preferences', { headers, data: { timeZone: 'Invalid/Zone', expectedRevision: current.revision } })).status()).toBe(400)
    const identity = await (await owners[1].request.get('/api/auth/me')).json()
    const saved = await owners[0].request.patch('/api/preferences', { headers, data: { timeZone: 'America/Los_Angeles', expectedRevision: current.revision, ownerId: identity.accountId } })
    expect(saved.status()).toBe(200)
    const preference = await saved.json()
    expect((await (await owners[1].request.get('/api/preferences')).json()).timeZone).toBe('Europe/Warsaw')
    expect((await owners[0].request.post(`${process.env.E2E_CONTROL_URL}/restart-api`, { headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! } })).status()).toBe(200)
    expect(await (await owners[0].request.get('/api/preferences')).json()).toEqual(preference)
    expect(await (await owners[0].request.get('/api/expenses')).json()).toEqual(history)
    const returning = await browser.newContext({ timezoneId: 'Europe/Warsaw' })
    try {
      const login = await returning.newPage()
      await login.goto('/login')
      await login.getByLabel('Email address', { exact: true }).fill(credentials[0].email)
      await login.getByLabel('Password', { exact: true }).fill(credentials[0].password)
      await login.getByRole('button', { name: 'Log in', exact: true }).click()
      await expect(login.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
      expect(await (await returning.request.get('/api/preferences')).json()).toEqual(preference)
    } finally { await returning.close() }
    await pages[0].clock.install({ time: new Date('2030-01-01T00:00:00Z') })
    await pages[0].reload()
    const summary = await (await owners[0].request.get('/api/expenses/today')).json()
    await expect(pages[0].locator('time')).toHaveAttribute('datetime', summary.purchaseDate)
    await expect(pages[0].getByText('America/Los_Angeles', { exact: false })).toBeVisible()
  } finally { await Promise.all(owners.map(owner => owner.close())) }
})

test('unavailable settings offer retry and expired save hides protected settings', async ({ page, context }) => {
  await register(page)
  await page.route('**/api/preferences/time-zones', route => route.fulfill({ status: 503, json: {} }))
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('We couldn’t load your settings')
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await page.unroute('**/api/preferences/time-zones')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('combobox', { name: /^Time zone/ })).toBeVisible()
  expect((await context.request.post(`${process.env.E2E_CONTROL_URL}/expire-sessions`, { headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! } })).status()).toBe(204)
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your session has ended.' })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveCount(0)
})

test('visibility revalidation preserves a draft and interrupted saves remain recoverable', async ({ page }) => {
  await register(page)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  const zone = page.getByRole('combobox', { name: /^Time zone/ })
  await zone.fill('America/Los_Angeles')
  await page.getByRole('option', { name: 'America/Los_Angeles', exact: true }).click()
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(zone).toHaveValue('America/Los_Angeles')
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/preferences', async route => {
    if (route.request().method() !== 'PATCH') { await route.continue(); return }
    await held
    try { await route.continue() } catch { /* Client can cancel before transport begins. */ }
  })
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Saving settings…' })).toBeDisabled()
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  release()
  await expect(page.getByText('A save was interrupted.', { exact: false })).toBeVisible()
  await expect(zone).toHaveValue('America/Los_Angeles')
  await page.unroute('**/api/preferences')
  await page.getByRole('button', { name: 'Reload settings' }).click()
  await expect(zone).toBeVisible()
})
