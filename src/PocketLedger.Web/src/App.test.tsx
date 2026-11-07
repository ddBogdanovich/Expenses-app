// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { formatTotal } from './features/today/today-api'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const identity = { accountId: 'local-account' }
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(new Date())
const total = (totalGrosz = '1234') => ({ purchaseDate: today(), totalGrosz })

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); history.replaceState(null, '', '/') })

it('verifies the selected cookie session before requesting private spending', async () => {
  let verify!: (response: Response) => void
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { verify = resolve }))
    .mockResolvedValue(json(total()))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  expect(screen.queryByRole('heading', { name: 'Today’s spending' })).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => verify(json(identity)))
  await screen.findByText('12,34 zł')
  for (const call of fetchMock.mock.calls) expect(call[1]).toMatchObject({ headers: { 'X-PocketLedger-Auth': 'preview' }, cache: 'no-store', credentials: 'same-origin' })
  expect(history.state).toEqual({ pocketledgerVerified: true })
})

it('fails closed on verification errors and allows explicit retry', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(json(identity)).mockResolvedValue(json(total()))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Try again' }))
  await screen.findByText('12,34 zł')
})

it('rejects malformed success responses instead of displaying private content', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ accessToken: 'obsolete' })))
  render(<App />)
  await screen.findByRole('heading', { name: 'We couldn’t verify your session.' })
  expect(screen.queryByRole('heading', { name: 'Today’s spending' })).toBeNull()
})

it('clears protected spending before logout and permits retry after a failed request token', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json(identity)).mockResolvedValueOnce(json(total()))
    .mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({}, 401))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await screen.findByText('12,34 zł')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Log out' }))
  await screen.findByRole('heading', { name: 'Logout is incomplete.' })
  expect(screen.queryByText('12,34 zł')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Try logout again' }))
  await screen.findByRole('heading', { name: 'Logout is incomplete.' })
})

it('submits an antiforgery-protected logout form without exposing a provider token', async () => {
  const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(identity)).mockResolvedValueOnce(json(total()))
    .mockResolvedValueOnce(json({ requestToken: 'request-bound-token' })))
  render(<App />)
  await screen.findByText('12,34 zł')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))
  expect(submit).toHaveBeenCalledOnce()
  const form = document.querySelector('form')!
  expect(form.method).toBe('post')
  expect(form.getAttribute('action')).toBe('/api/auth/preview/logout')
  expect(form.querySelector('input')?.value).toBe('request-bound-token')
  form.remove()
  expect(screen.queryByText('12,34 zł')).toBeNull()
})

it('replaces rejected spending with an ended-session recovery action', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(identity)).mockResolvedValueOnce(json({}, 401)))
  render(<App />)
  await screen.findByRole('heading', { name: 'Your session has ended.' })
  expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/api/auth/preview/start?returnUrl=%2F&mode=login')
  expect(screen.queryByRole('heading', { name: 'Today’s spending' })).toBeNull()
})

it('offers retry for an unavailable daily total', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(identity)).mockResolvedValueOnce(json({}, 503)).mockResolvedValue(json(total('0'))))
  render(<App />)
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Try again' }))
  await screen.findByText('0,00 zł')
})

it('restores and periodically verifies the protected design reference', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  history.replaceState(null, '', '/design-system')
  const fetchMock = vi.fn().mockResolvedValueOnce(json(identity)).mockResolvedValueOnce(json({}, 401))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await screen.findByText('DESIGN REFERENCE · DEVELOPMENT ONLY')
  await act(async () => vi.advanceTimersByTimeAsync(60_000))
  await screen.findByRole('heading', { name: 'Your session has ended.' })
  expect(screen.queryByText('DESIGN REFERENCE · DEVELOPMENT ONLY')).toBeNull()
  expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toContain('returnUrl=%2Fdesign-system')
})

it('checks the session on navigation between today and the development reference', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => Promise.resolve(json(url === '/api/auth/me' ? identity : total()))))
  render(<App />)
  await screen.findByText('12,34 zł')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Design reference' }))
  await screen.findByText('DESIGN REFERENCE · DEVELOPMENT ONLY')
  await user.click(screen.getByRole('button', { name: 'Back to today' }))
  await screen.findByText('12,34 zł')
  expect(location.pathname).toBe('/')
})

it('hides content before a page enters history and verifies again when restored', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(identity)).mockResolvedValueOnce(json(total())).mockResolvedValueOnce(json({}, 401)))
  render(<App />)
  await screen.findByText('12,34 zł')
  act(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  expect(screen.queryByText('12,34 zł')).toBeNull()
  act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  await screen.findByRole('heading', { name: 'Your session has ended.' })
})

it('ignores a late verification after logout', async () => {
  let finish!: (response: Response) => void
  const fetchMock = vi.fn().mockResolvedValueOnce(json(identity)).mockResolvedValueOnce(json(total()))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
    .mockResolvedValueOnce(json({}, 503))
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  render(<App />)
  await screen.findByText('12,34 zł')
  await act(async () => vi.advanceTimersByTimeAsync(60_000))
  await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))
  await screen.findByRole('heading', { name: 'Logout is incomplete.' })
  await act(async () => finish(json(identity)))
  expect(screen.queryByText('12,34 zł')).toBeNull()
})

it('formats zero, a grosz and totals beyond JavaScript’s safe integer range', () => {
  const normalized = (digits: string) => formatTotal(digits).replace(/\s/g, ' ')
  expect(normalized('0')).toBe('0,00 zł')
  expect(normalized('1')).toBe('0,01 zł')
  expect(normalized('9223372036854775808')).toBe('92 233 720 368 547 758,08 zł')
})

it('reloads a total when the response crosses Warsaw midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-02T22:59:59Z'))
  let finishYesterday!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(identity))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finishYesterday = resolve }))
    .mockResolvedValueOnce(json({ purchaseDate: '2026-11-03', totalGrosz: '0' })))
  render(<App />)
  await screen.findByText('Loading today’s spending…')
  vi.setSystemTime(new Date('2026-11-02T23:00:01Z'))
  await act(async () => finishYesterday(json({ purchaseDate: '2026-11-02', totalGrosz: '1234' })))
  await screen.findByText('0,00 zł')
  expect(screen.queryByText('12,34 zł')).toBeNull()
})

it.each([
  ['auth.provider_unavailable', 'Login is temporarily unavailable.'],
  ['auth.cancelled', 'Login was cancelled.'],
  ['auth.transaction_expired', 'Your login attempt has expired.'],
  ['auth.callback_failed', 'We couldn’t complete login.'],
  ['untrusted-description', 'We couldn’t complete login.'],
  ['constructor', 'We couldn’t complete login.'],
  ['__proto__', 'We couldn’t complete login.'],
])('presents bounded recovery for %s without automatic login loops', async (code, title) => {
  history.replaceState(null, '', `/auth/recovery?code=${code}`)
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  expect(screen.getByRole('heading', { name: title })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Try again' })).toBeTruthy()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.queryByText('untrusted-description')).toBeNull()
})

it('verifies logout before showing the signed-out landing page', async () => {
  history.replaceState(null, '', '/auth/signed-out')
  const fetchMock = vi.fn().mockResolvedValue(json({}, 401))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await screen.findByRole('heading', { name: 'You’re logged out.' })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('keeps expired recovery usable after history restoration', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(identity)).mockResolvedValueOnce(json({}, 401)))
  render(<App />)
  await screen.findByRole('heading', { name: 'Your session has ended.' })
  act(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy()
  expect(screen.queryByText('Checking your session…')).toBeNull()
})

it('does not let periodic verification restore spending after failed logout', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  const fetchMock = vi.fn().mockResolvedValueOnce(json(identity)).mockResolvedValueOnce(json(total()))
    .mockResolvedValueOnce(json({}, 503)).mockResolvedValue(json(identity))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await screen.findByText('12,34 zł')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))
  await screen.findByRole('heading', { name: 'Logout is incomplete.' })
  act(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  await act(async () => vi.advanceTimersByTimeAsync(60_000))
  expect(screen.getByRole('button', { name: 'Try logout again' })).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it('never claims logout succeeded when directly opening the landing URL with a valid session', async () => {
  history.replaceState(null, '', '/auth/signed-out')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(identity)))
  render(<App />)
  await screen.findByRole('heading', { name: 'Logout is incomplete.' })
  expect(screen.queryByText('You’re logged out.')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Today’s spending' })).toBeNull()
})

it('restores retry after navigating Back from a public logout-recovery attempt', async () => {
  history.replaceState(null, '', '/auth/recovery?code=auth.logout_incomplete')
  const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ requestToken: 'request-bound-token' })))
  render(<App />)
  await userEvent.setup().click(screen.getByRole('button', { name: 'Try logout again' }))
  expect(submit).toHaveBeenCalledOnce()
  expect(screen.getByRole('heading', { name: 'Logging out…' })).toBeTruthy()
  act(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })))
  act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })))
  expect(screen.getByRole('button', { name: 'Try logout again' })).toBeTruthy()
  document.querySelector('form')?.remove()
})
