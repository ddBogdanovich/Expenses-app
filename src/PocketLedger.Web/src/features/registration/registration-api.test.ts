import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerAccount } from './registration-api'

afterEach(() => vi.unstubAllGlobals())

describe('registration HTTP boundary', () => {
  it.each([
    [201, '{}'], [201, '{"accessToken":123}'], [201, '{"accessToken":""}'],
    [500, 'internal error'], [200, '{"accessToken":"unexpected-status"}'],
  ])('does not claim success for an unusable response (%s, %s)', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })))
    expect((await registerAccount({ email: 'a@example.com', password: 'a long password' })).success).toBe(false)
  })

  it('maps server password validation and trims only the email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"code":"auth.weak_password"}', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await registerAccount({ email: ' a@example.com ', password: '  password  ' })
    expect(result).toMatchObject({ success: false, field: 'password' })
    expect(fetchMock.mock.calls[0][1].body).toBe('{"email":"a@example.com","password":"  password  "}')
  })
})
