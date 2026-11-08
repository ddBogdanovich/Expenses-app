import { useEffect, useRef, useState } from 'react'
import { Button } from '@heroui/react'
import PageShell from '../../ui/PageShell'
import SpendingSummary from './SpendingSummary'
import { requestTimeoutMs } from '../../request-policy'
import { getDailyTotal, UnavailableTimeZone } from './today-api'
import type { DailyTotal } from './today-api'

const minuteMs = 60_000
const sessionEnded = 'Your session has ended. Log in again to see today’s spending.'

type Props = { onEndSession: (message?: string) => void; onOpenDesignSystem?: () => void; onOpenSettings?: () => void }

export default function TodayPage({ onEndSession, onOpenDesignSystem, onOpenSettings }: Props) {
  const [total, setTotal] = useState<DailyTotal | null>(null)
  const [failed, setFailed] = useState(false)
  const [unavailableZone, setUnavailableZone] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])

  useEffect(() => {
    const lifetime = new AbortController()
    let inFlight = false
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      if (inFlight || lifetime.signal.aborted) return
      inFlight = true
      setTotal(null)
      setFailed(false)
      try {
        const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(requestTimeoutMs)])
        const result = await getDailyTotal(signal)
        if (lifetime.signal.aborted) return
        if (result === 'unauthorized') onEndSession(sessionEnded)
        else {
          setTotal(result)
          setFailed(false)
        }
      } catch (error) {
        if (!lifetime.signal.aborted) {
          setUnavailableZone(error instanceof UnavailableTimeZone)
          setTotal(null)
          setFailed(true)
        }
      } finally {
        inFlight = false
        if (!lifetime.signal.aborted) {
          clearTimeout(timer)
          timer = setTimeout(refresh, minuteMs)
        }
      }
    }
    function onVisible() {
      if (!document.hidden) void refresh()
    }
    void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      lifetime.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [attempt, onEndSession])

  return (
    <PageShell headerAction={<nav className="header-actions" aria-label="Account">
      {onOpenSettings && <Button variant="ghost" onPress={onOpenSettings}>Settings</Button>}
      {onOpenDesignSystem && <Button variant="ghost" onPress={onOpenDesignSystem}>Design reference</Button>}
      <Button variant="outline" onPress={() => onEndSession()}>Log out</Button>
    </nav>}>
      <main id="main-content" className="today-main" tabIndex={-1}>
        <span className="eyebrow">DAILY OVERVIEW</span>
        <h1 className="page-title" ref={heading} tabIndex={-1}>Today’s spending</h1>
        <SpendingSummary state={total ? { status: 'ready', total } : failed ? {
          status: 'error', onOpenSettings: unavailableZone ? onOpenSettings : undefined, onRetry: () => { setFailed(false); setAttempt(value => value + 1) },
        } : { status: 'loading' }} />
        <p className="daily-note">Includes all your purchases dated today in your saved time zone.</p>
      </main>
    </PageShell>
  )
}
