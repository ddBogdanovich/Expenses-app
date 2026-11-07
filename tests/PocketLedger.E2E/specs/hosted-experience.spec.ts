import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

async function openRegistration(page: Page) {
  const start = await page.request.get('/api/auth/preview/start', { maxRedirects: 0 })
  expect(start.status()).toBe(302)
  const url = new URL(start.headers().location)
  url.pathname = url.pathname.replace(/\/auth$/, '/registrations')
  await page.goto(url.toString())
  await expect(page.locator('#kc-register-form')).toBeVisible()
}

test('hosted forms switch modes and retain accessible email/password interactions', async ({ page }) => {
  await page.goto('/api/auth/preview/start')
  await expect(page.getByRole('link', { name: 'Create an account', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Create an account', exact: true }).click()
  await expect(page.locator('#kc-register-form')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Make room for clarity.' })).toBeVisible()
  await expect(page.locator('input:not([type=hidden])')).toHaveCount(2)
  const email = page.getByLabel('Email address', { exact: true })
  const password = page.getByLabel('Password', { exact: true })
  await expect(email).toHaveAttribute('autocomplete', 'email')
  await expect(password).toHaveAttribute('autocomplete', 'new-password')
  await email.fill('paste@example.com')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin })
  await page.evaluate(() => navigator.clipboard.writeText('a pasted passphrase'))
  await password.focus()
  await page.keyboard.press('ControlOrMeta+V')
  await expect(password).toHaveValue('a pasted passphrase')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('a pasted passphrase')
  await page.getByRole('button', { name: 'Hide password' }).click()
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('link', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Log in', exact: true })).toBeVisible()
  await expect(page.getByLabel('Email address', { exact: true })).toHaveAttribute('autocomplete', 'username')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
})

test('invalid registration keeps email and clears only the edited field error', async ({ page }) => {
  await openRegistration(page)
  // Bypass browser validation to exercise the real provider's validation response.
  await page.locator('form').evaluate(form => { form.noValidate = true })
  await page.getByLabel('Email address', { exact: true }).fill('invalid-email')
  await page.getByLabel('Password', { exact: true }).fill('short')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.locator('#input-error-email')).toBeVisible()
  await expect(page.locator('#input-error-password')).toBeVisible()
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue('invalid-email')
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Email address', { exact: true })).toBeFocused()
  await page.getByLabel('Password', { exact: true }).fill('a valid passphrase')
  await expect(page.locator('#input-error-password')).toBeHidden()
  await expect(page.locator('#input-error-email')).toBeVisible()
  await page.getByLabel('Email address', { exact: true }).fill('valid@example.com')
  await expect(page.locator('#input-error-email')).toBeHidden()
})

test('unknown email and wrong password have the same generic login failure', async ({ page }) => {
  const messages: string[] = []
  for (const email of [`unknown-${randomUUID()}@example.com`, process.env.E2E_USER_EMAIL!]) {
    await page.goto('/api/auth/preview/start')
    await page.getByLabel('Email address', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill('incorrect passphrase')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    messages.push((await page.getByRole('alert').textContent())!)
    await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(email)
    await expect(page.getByRole('alert')).toBeFocused()
    await page.getByLabel('Password', { exact: true }).fill('edited passphrase')
    await expect(page.getByRole('alert')).toBeHidden()
  }
  expect(messages[0]).toBe('The email or password is incorrect. Try again.')
  expect(messages[1]).toBe(messages[0])
})

test('hosted submission announces pending and prevents repeated credential posts', async ({ page }) => {
  await openRegistration(page)
  await page.getByLabel('Email address', { exact: true }).fill(`pending-${randomUUID()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('a valid passphrase')
  let posts = 0
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/login-actions/registration**', async route => {
    if (route.request().method() === 'POST') { posts++; await gate }
    await route.continue()
  })
  try {
    await page.getByRole('button', { name: 'Create account', exact: true }).click({ noWaitAfter: true })
    // The document navigation is deliberately held; locator checks wait for that
    // navigation. Read the current DOM directly while the POST is in flight.
    expect(await page.evaluate(() => {
      const button = document.querySelector<HTMLButtonElement>('[data-pending-label]')!
      return { label: button.textContent, disabled: button.disabled, busy: document.querySelector('form')!.getAttribute('aria-busy') }
    })).toEqual({ label: 'Creating your account…', disabled: true, busy: 'true' })
    await page.evaluate(() => document.querySelector('form')!.requestSubmit())
    await expect.poll(() => posts).toBe(1)
  } finally { release() }
  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toBeVisible()
})

test('registration confirms verified creation and continues without another password prompt', async ({ page, context }) => {
  await openRegistration(page)
  const email = `confirmation-${randomUUID()}@example.com`
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('a valid passphrase')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toBeVisible()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  expect((await context.request.get('/api/auth/me', { headers: { 'X-PocketLedger-Auth': 'preview' } })).status()).toBe(401)
  await page.getByRole('button', { name: 'View today’s spending' }).click()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  expect((await context.request.get('/api/auth/me', { headers: { 'X-PocketLedger-Auth': 'preview' } })).status()).toBe(200)
  await page.goto('/preview?registered=true&email=forged@example.com')
  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toHaveCount(0)
})

test('confirmation cannot be requested with a forged provider action or email', async ({ page, context }) => {
  await page.goto('/api/auth/preview/start')
  const provider = new URL(page.url())
  provider.pathname = '/realms/pocketledger/login-actions/required-action'
  provider.search = new URLSearchParams({ execution: 'pocketledger-registration-confirmation',
    client_id: 'pocketledger-web', confirmationEmail: 'forged@example.com', registered: 'true' }).toString()
  await page.goto(provider.toString())
  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toHaveCount(0)
  await expect(page.getByText('forged@example.com', { exact: true })).toHaveCount(0)
  expect((await context.request.get('/api/auth/me', { headers: { 'X-PocketLedger-Auth': 'preview' } })).status()).toBe(401)
})

test('an existing user cannot receive confirmation without the server-created registration note', async ({ page, context }) => {
  await openRegistration(page)
  const email = `existing-${randomUUID()}@example.com`
  const password = `Disposable-${randomUUID()}`
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByRole('button', { name: 'View today’s spending' }).click()
  await expect(page.getByRole('heading', { name: 'Today’s spending' })).toBeVisible()
  const assigned = await context.request.post(`${process.env.E2E_CONTROL_URL}/require-confirmation`, {
    headers: { 'X-E2E-Control': process.env.E2E_CONTROL_TOKEN! }, data: { email },
  })
  expect(assigned.status()).toBe(204)
  await context.clearCookies()
  await page.goto('/api/auth/preview/start')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  // Phase 5 presents the same bounded cancellation through browser recovery.
  // The same negative assertion remains: a rejected action never authenticates.
  await expect(page).toHaveURL(/\/auth\/recovery\?code=auth.cancelled/)
  await expect(page.getByRole('heading', { name: 'Login was cancelled.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'You’re all set.' })).toHaveCount(0)
  expect((await context.request.get('/api/auth/me', { headers: { 'X-PocketLedger-Auth': 'preview' } })).status()).toBe(401)
})

test('a branded provider error returns through a fresh approved login transaction', async ({ page }) => {
  await page.goto('/api/auth/preview/start')
  const provider = new URL(page.url())
  provider.pathname = '/realms/pocketledger/protocol/openid-connect/auth'
  provider.search = new URLSearchParams({ client_id: 'pocketledger-web', response_type: 'code',
    redirect_uri: 'https://invalid.example/callback' }).toString()
  await page.goto(provider.toString())
  await expect(page.getByRole('heading', { name: 'Let’s try that again.' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to login' }).click()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  provider.searchParams.set('client_id', 'not-a-real-client')
  await page.goto(provider.toString())
  await expect(page.getByRole('heading', { name: 'Let’s try that again.' })).toBeVisible()
  await expect(page.getByText('Open PocketLedger to start a new login.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to login' })).toHaveCount(0)
})

const viewports = [[440, 956], [430, 932], [428, 926], [414, 896], [375, 812], [320, 568], [956, 440], [768, 1024], [1440, 1000], [440, 420]]
test('hosted registration retains the full responsive and keyboard contract', async ({ page }) => {
  await openRegistration(page)
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height })
    for (const enlarged of [false, true]) {
      await page.evaluate(value => { document.documentElement.style.fontSize = value ? '200%' : '' }, enlarged)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const compact = width <= 760 || (width <= 1024 && height <= 540) || enlarged
      if (compact) await expect(page.locator('.intro')).toBeHidden()
      for (const control of await page.locator('input:not([type=hidden]), button, .account-link').all()) {
        const box = await control.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(48)
      }
      const submit = page.getByRole('button', { name: 'Create account', exact: true })
      await submit.scrollIntoViewIfNeeded()
      await expect(submit).toBeInViewport()
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByLabel('Email address', { exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Show password' })).toBeFocused()
})
