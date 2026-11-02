import { requestTimeoutMs } from '../../request-policy'

export const passwordPolicy = { minimumLength: 12, maximumLength: 128 } as const

export type Credentials = { email: string; password: string }

export type AuthError = { message: string; field?: 'email' | 'password' }
export type AuthResult =
  | { success: true; accessToken: string }
  | ({ success: false } & AuthError)

export type AuthMode = 'login' | 'register'

export async function authenticate(mode: AuthMode, credentials: Credentials): Promise<AuthResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...credentials, email: credentials.email.trim() }),
    })
    const body: unknown = await response.json().catch(() => null)
    controller.signal.throwIfAborted()
    if (response.status === (mode === 'register' ? 201 : 200) && typeof body === 'object' && body !== null &&
        'accessToken' in body && typeof body.accessToken === 'string' && body.accessToken.length > 0) {
      return { success: true, accessToken: body.accessToken }
    }
    if (mode === 'login' && response.status === 401) {
      return { success: false, message: 'The email or password is incorrect. Try again.' }
    }
    if (mode === 'register' && response.status === 409) {
      return { success: false, field: 'email', message: 'An account with this email already exists. Try a different email.' }
    }
    if (response.status === 400) {
      const code = typeof body === 'object' && body !== null && 'code' in body ? body.code : null
      return code === 'auth.weak_password'
        ? { success: false, field: 'password', message: `Use at least ${passwordPolicy.minimumLength} characters.` }
        : { success: false, message: 'Check your email and password, then try again.' }
    }
    return { success: false, message: mode === 'login' ? 'We couldn’t log you in right now. Please try again.' : 'We couldn’t create your account right now. Please try again.' }
  } catch {
    if (controller.signal.aborted) {
      return { success: false, message: mode === 'login' ? 'The request timed out. Please try again.' : 'The request timed out. Please try again. Your account may already have been created.' }
    }
    return { success: false, message: 'We couldn’t reach PocketLedger. Check your connection and try again.' }
  } finally {
    clearTimeout(timeout)
  }
}
