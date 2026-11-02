import { useEffect, useState } from 'react'
import { Button } from '@heroui/react'
import { getSessionStatus } from '../features/authentication/auth-api'
import { requestTimeoutMs } from '../request-policy'
import PageShell from '../ui/PageShell'
import Notice from '../ui/Notice'
import DesignSystemPage from './DesignSystemPage'

type Props = { token: string; onBack: () => void; onEndSession: (message?: string) => void }
type Access = 'checking' | 'allowed' | 'unavailable'

const sessionRecheckIntervalMs = 60_000
const sessionEnded = 'Your session has ended. Log in again to open the design reference.'

export default function DesignSystemRoute({ token, onBack, onEndSession }: Props) {
  const [access, setAccess] = useState<Access>('checking')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const lifetime = new AbortController()
    let inFlight = false
    async function verifySession() {
      if (inFlight || lifetime.signal.aborted) return
      inFlight = true
      try {
        const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(requestTimeoutMs)])
        const status = await getSessionStatus(token, signal)
        if (lifetime.signal.aborted) return
        if (status === 'unauthorized') onEndSession(sessionEnded)
        else setAccess('allowed')
      } catch {
        if (!lifetime.signal.aborted) setAccess('unavailable')
      } finally {
        inFlight = false
      }
    }
    function onVisible() { if (!document.hidden) void verifySession() }
    void verifySession()
    const timer = setInterval(() => void verifySession(), sessionRecheckIntervalMs)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      lifetime.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token, attempt, onEndSession])

  if (access === 'allowed') return <DesignSystemPage onBack={onBack} onEndSession={onEndSession} />

  return <PageShell headerAction={<Button variant="outline" onPress={() => onEndSession()}>Log out</Button>}>
    <main id="main-content" tabIndex={-1} className="today-main">
      <h1 className="page-title">Design reference</h1>
      {access === 'checking' ? <Notice tone="info">Checking your session…</Notice> : <>
        <Notice tone="danger">We couldn’t verify your session. Check your connection and try again.</Notice>
        <div className="header-actions">
          <Button onPress={() => { setAccess('checking'); setAttempt(value => value + 1) }}>Try again</Button>
          <Button variant="outline" onPress={onBack}>Back to today</Button>
        </div>
      </>}
    </main>
  </PageShell>
}
