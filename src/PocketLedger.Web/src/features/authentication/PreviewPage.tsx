import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@heroui/react'
import PageShell from '../../ui/PageShell'
import Notice from '../../ui/Notice'
import TodayPage from '../today/TodayPage'
import { requestTimeoutMs } from '../../request-policy'

const headers = { 'X-PocketLedger-Auth': 'preview' }
type Session = 'checking' | 'signed-in' | 'signed-out' | 'unavailable'

export default function PreviewPage() {
  const [session, setSession] = useState<Session>('checking')
  const [attempt, setAttempt] = useState(0)
  const [notice, setNotice] = useState(new URLSearchParams(window.location.search).has('error')
    ? 'We couldn’t complete login. Please try again.' : '')
  const heading = useRef<HTMLHeadingElement>(null)
  const loggingOut = useRef(false)

  useEffect(() => {
    const lifetime = new AbortController()
    async function verify() {
      try {
        const response = await fetch('/api/auth/me', {
          headers, cache: 'no-store', signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(requestTimeoutMs)]),
        })
        if (!lifetime.signal.aborted) setSession(response.ok ? 'signed-in' : response.status === 401 ? 'signed-out' : 'unavailable')
      } catch {
        if (!lifetime.signal.aborted) setSession('unavailable')
      }
    }
    void verify()
    const onPageShow = () => { setSession('checking'); void verify() }
    window.addEventListener('pageshow', onPageShow)
    return () => { lifetime.abort(); window.removeEventListener('pageshow', onPageShow) }
  }, [attempt])

  useEffect(() => { if (session !== 'signed-in') heading.current?.focus({ preventScroll: true }) }, [session])

  const endSession = useCallback((message?: string) => {
    if (message) { setNotice(message); setSession('signed-out'); return }
    if (loggingOut.current) return
    loggingOut.current = true
    setSession('checking')
    async function logout() {
      try {
        const response = await fetch('/api/auth/preview/antiforgery', { cache: 'no-store', signal: AbortSignal.timeout(requestTimeoutMs) })
        if (!response.ok) throw new Error('Sign-out unavailable')
        const { requestToken } = await response.json()
        if (typeof requestToken !== 'string') throw new Error('Invalid request token')
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
      } catch {
        setNotice('We couldn’t complete logout. Check your connection and try again.')
        setSession('unavailable')
        loggingOut.current = false
      }
    }
    void logout()
  }, [])

  if (session === 'signed-in') return <TodayPage token="" preview onEndSession={endSession} />

  return <PageShell>
    <main id="main-content" className="today-main" tabIndex={-1}>
      <h1 className="page-title" tabIndex={-1} ref={heading}>Keycloak preview</h1>
      <p>Try the new login experience. Your existing account remains available through the usual login.</p>
      {notice && <Notice tone="info">{notice}</Notice>}
      {session === 'checking' ? <p role="status">Checking your session…</p>
        : session === 'unavailable' ? <Notice tone="danger">We couldn’t verify your session. <Button variant="outline" onPress={() => { setSession('checking'); setAttempt(value => value + 1) }}>Try again</Button></Notice>
          : <p><a className="account-link" href="/api/auth/preview/start">Log in with Keycloak</a></p>}
      <p><a className="account-link" href="/login">Back to usual login</a></p>
    </main>
  </PageShell>
}
