import { afterEach, describe, expect, it, vi } from 'vitest'
import { authenticate } from './auth-api'
import { requestTimeoutMs } from '../../request-policy'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('registration HTTP boundary', () => {
  it.each([
    [201, '{}'], [201, '{"accessToken":123}'], [201, '{"accessToken":""}'],
    [500, 'internal error'], [200, '{"accessToken":"unexpected-status"}'],
  ])('does not claim success for an unusable response (%s, %s)', async (status, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })))
    expect((await authenticate('register', { email: 'a@example.com', password: 'a long password' })).success).toBe(false)
  })

  it('maps server password validation and trims only the email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"code":"auth.weak_password"}', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await authenticate('register', { email: ' a@example.com ', password: '  password  ' })
    expect(result).toMatchObject({ success: false, field: 'password' })
    expect(fetchMock.mock.calls[0][1].body).toBe('{"email":"a@example.com","password":"  password  "}')
  })
})


describe('registration timeout recovery', () => {
  it.each(['headers', 'body'])('aborts a stalled response during %s and permits retry', async (phase) => {
    vi.useFakeTimers()
    let requestSignal!: AbortSignal
    const fetchMock = vi.fn((_url, options) => {
      requestSignal = options.signal
      const stalled = new Promise<never>((_resolve, reject) => {
        requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
      return phase === 'headers' ? stalled : Promise.resolve({ status: 201, json: () => stalled })
    })
    vi.stubGlobal('fetch', fetchMock)
    const pending = authenticate('register', { email: 'a@example.com', password: 'a long password' })
    await vi.advanceTimersByTimeAsync(requestTimeoutMs)
    expect(await pending).toMatchObject({ success: false, message: expect.stringContaining('timed out') })
    expect(requestSignal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"accessToken":"retry"}', { status: 201 })))
    expect((await authenticate('register', { email: 'a@example.com', password: 'a long password' })).success).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
