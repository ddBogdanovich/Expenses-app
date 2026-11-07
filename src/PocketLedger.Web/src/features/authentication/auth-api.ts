import { requestTimeoutMs } from '../../request-policy'

// Temporary scheme selector until the legacy backend is retired in Phase 6.
export const sessionHeaders = { 'X-PocketLedger-Auth': 'preview' } as const
export type AuthMode = 'login' | 'register'
export type Destination = '/' | '/design-system'

export function hostedEntry(mode: AuthMode = 'login', destination: Destination = '/') {
  const query = new URLSearchParams({ returnUrl: destination, mode })
  return `/api/auth/preview/start?${query}`
}

export async function getSessionStatus(signal: AbortSignal): Promise<'authorized' | 'unauthorized'> {
  const response = await fetch('/api/auth/me', { headers: sessionHeaders, credentials: 'same-origin', cache: 'no-store', signal })
  if (response.status === 401 || response.status === 403) return 'unauthorized'
  if (response.status !== 200) throw new Error('Unable to verify session')
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !('accountId' in body) ||
      typeof body.accountId !== 'string' || !body.accountId) throw new Error('Invalid session')
  return 'authorized'
}

export async function submitLogout() {
  const response = await fetch('/api/auth/preview/logout-token', {
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(requestTimeoutMs),
  })
  if (!response.ok) throw new Error('Sign-out unavailable')
  const { requestToken } = await response.json()
  if (typeof requestToken !== 'string' || !requestToken) throw new Error('Invalid request token')
  const form = document.createElement('form')
  form.method = 'post'
  form.action = '/api/auth/preview/logout'
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = '__RequestVerificationToken'
  input.value = requestToken
  form.append(input)
  document.body.append(form)
  form.submit()
}
