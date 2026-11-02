export const passwordPolicy = { minimumLength: 12, maximumLength: 128 } as const

export type Credentials = { email: string; password: string }
export const registrationRequestTimeoutMs = 15_000

export type RegistrationError = { message: string; field?: 'email' | 'password' }
export type RegistrationResult =
  | { success: true; accessToken: string }
  | ({ success: false } & RegistrationError)

export async function registerAccount(credentials: Credentials): Promise<RegistrationResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), registrationRequestTimeoutMs)
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...credentials, email: credentials.email.trim() }),
    })
    const body: unknown = await response.json().catch(() => null)
    controller.signal.throwIfAborted()
    if (response.status === 201 && typeof body === 'object' && body !== null &&
        'accessToken' in body && typeof body.accessToken === 'string' && body.accessToken.length > 0) {
      return { success: true, accessToken: body.accessToken }
    }
    if (response.status === 409) {
      return { success: false, field: 'email', message: 'An account with this email already exists. Try a different email.' }
    }
    if (response.status === 400) {
      const code = typeof body === 'object' && body !== null && 'code' in body ? body.code : null
      return code === 'auth.weak_password'
        ? { success: false, field: 'password', message: `Use at least ${passwordPolicy.minimumLength} characters.` }
        : { success: false, message: 'Check your email and password, then try again.' }
    }
    return { success: false, message: 'We couldn’t create your account right now. Please try again.' }
  } catch {
    if (controller.signal.aborted) {
      return { success: false, message: 'The request timed out. Please try again. Your account may already have been created.' }
    }
    return { success: false, message: 'We couldn’t reach PocketLedger. Check your connection and try again.' }
  } finally {
    clearTimeout(timeout)
  }
}
