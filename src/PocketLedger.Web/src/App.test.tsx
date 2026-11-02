// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { formatTotal } from './features/today/today-api'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); history.replaceState(null, '', '/') })

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

async function enterCredentials(email = 'owner@example.com') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/Email address/), email)
  await user.type(screen.getByLabelText(/Password/, { selector: 'input' }), 'password')
  await user.click(screen.getByRole('button', { name: 'Log in' }))
  return user
}

it('guards direct entry, logs in, shows exact PLN for the owner and logs out', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json({ accessToken: 'session' }))
    .mockResolvedValueOnce(json({ purchaseDate: '2026-11-02', totalGrosz: '1234' }))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  expect(location.pathname).toBe('/login')
  expect(fetchMock).not.toHaveBeenCalled()
  const email = '"first last"@example.com'
  const user = await enterCredentials(email)
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ email, password: 'password' }),
  }))
  await screen.findByText('12,34 zł')
  expect(location.pathname).toBe('/')
  expect(fetchMock).toHaveBeenCalledWith('/api/expenses/today', expect.objectContaining({
    headers: { Authorization: 'Bearer session' },
  }))
  await user.click(screen.getByRole('button', { name: 'Log out' }))
  expect(location.pathname).toBe('/login')
  expect(screen.queryByText('12,34 zł')).toBeNull()
})

it('keeps invalid credentials on login and never requests private data', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json({}, 401))
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)
  await enterCredentials()
  expect((await screen.findByRole('alert')).textContent).toContain('email or password is incorrect')
  expect(location.pathname).toBe('/login')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('offers retry for an unavailable total and sends rejected sessions back to login', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ accessToken: 'session' }))
    .mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json({}, 401)))
  render(<App />)
  const user = await enterCredentials()
  await user.click(await screen.findByRole('button', { name: 'Try again' }))
  await screen.findByText(/Your session has ended/)
  expect(location.pathname).toBe('/login')
  expect(screen.queryByRole('heading', { name: 'Today’s spending' })).toBeNull()
})

it('formats zero, a grosz and totals beyond JavaScript’s safe integer range', () => {
  const normalized = (digits: string) => formatTotal(digits).replace(/\s/g, ' ')
  expect(normalized('0')).toBe('0,00 zł')
  expect(normalized('1')).toBe('0,01 zł')
  expect(normalized('9223372036854775808')).toBe('92 233 720 368 547 758,08 zł')
})

it('reloads the total when a response crosses Warsaw midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  try {
    vi.setSystemTime(new Date('2026-11-02T22:59:59Z'))
    let finishYesterday!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ accessToken: 'session' }))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finishYesterday = resolve }))
      .mockResolvedValueOnce(json({ purchaseDate: '2026-11-03', totalGrosz: '0' })))
    render(<App />)
    await enterCredentials()
    await screen.findByText('Loading today’s spending…')
    vi.setSystemTime(new Date('2026-11-02T23:00:01Z'))
    finishYesterday(json({ purchaseDate: '2026-11-02', totalGrosz: '1234' }))
    await screen.findByText('0,00 zł')
    expect(screen.queryByText('12,34 zł')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})
