// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountPage from './AccountPage'

async function fillForm(password = 'a long test password') {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email address', { exact: false }), 'owner@example.com')
  await user.type(screen.getByLabelText('Password', { exact: false, selector: 'input' }), password)
  return user
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('registration', () => {
  it('submits credentials, blocks duplicate submits and shows success only after a token', async () => {
    let resolve!: (response: Response) => void
    const fetchMock = vi.fn(() => new Promise<Response>((done) => { resolve = done }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountPage mode="register" onAuthenticated={vi.fn()} />)
    const user = await fillForm()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: 'owner@example.com', password: 'a long test password' }),
    }))
    expect(screen.getByRole('button', { name: 'Creating your account…' }).hasAttribute('disabled')).toBe(true)
    resolve(new Response(JSON.stringify({ accessToken: 'test-token' }), { status: 201 }))
    await screen.findByText('You’re all set.')
    expect(screen.queryByLabelText('Password', { exact: false, selector: 'input' })).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('prevents short passwords from reaching the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountPage mode="register" onAuthenticated={vi.fn()} />)
    const user = await fillForm('too short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Password', { exact: false, selector: 'input' }).getAttribute('aria-invalid')).toBe('true')
  })

  it('shows duplicate email feedback and permits correction and retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}', { status: 409 }))
      .mockResolvedValueOnce(new Response('{"accessToken":"retry-token"}', { status: 201 })))
    render(<AccountPage mode="register" onAuthenticated={vi.fn()} />)
    const user = await fillForm()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('already exists'))
    await user.type(screen.getByLabelText('Password', { exact: false, selector: 'input' }), 'changed')
    expect(screen.getByRole('alert').textContent).toContain('already exists')
    expect(screen.getByLabelText('Email address', { exact: false }).getAttribute('aria-invalid')).toBe('true')
    await user.type(screen.getByLabelText('Email address', { exact: false }), '.new')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await screen.findByText('You’re all set.')
  })

  it('supports password visibility and recovers from network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    render(<AccountPage mode="register" onAuthenticated={vi.fn()} />)
    const user = await fillForm()
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password', { exact: false, selector: 'input' }).getAttribute('type')).toBe('text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('connection'))
    expect(screen.getByRole('button', { name: 'Create account' }).hasAttribute('disabled')).toBe(false)
  })
})


it('retains server password errors when only the email changes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"code":"auth.weak_password"}', { status: 400 })))
  render(<AccountPage mode="register" onAuthenticated={vi.fn()} />)
  const user = await fillForm()
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('at least 12'))
  await user.type(screen.getByLabelText('Email address', { exact: false }), '.new')
  expect(screen.getByRole('alert').textContent).toContain('at least 12')
  await user.type(screen.getByLabelText('Password', { exact: false, selector: 'input' }), 'changed')
  expect(screen.queryByRole('alert')).toBeNull()
})
