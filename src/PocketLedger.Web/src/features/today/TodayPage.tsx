import { useEffect, useRef, useState } from 'react'
import { Button } from '@heroui/react'
import Brand from '../../Brand'
import { requestTimeoutMs } from '../../request-policy'
import { formatTotal, getDailyTotal } from './today-api'
import type { DailyTotal } from './today-api'

const businessTimeZone = 'Europe/Warsaw'
const warsawDay = new Intl.DateTimeFormat('sv-SE', { timeZone: businessTimeZone })
const displayDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' })
const minuteMs = 60_000
const sessionEnded = 'Your session has ended. Log in again to see today’s spending.'

type Props = { token: string; onEndSession: (message?: string) => void }

export default function TodayPage({ token, onEndSession }: Props) {
  const [total, setTotal] = useState<DailyTotal | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus() }, [])

  useEffect(() => {
    const lifetime = new AbortController()
    let inFlight = false
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      if (inFlight || lifetime.signal.aborted) return
      inFlight = true
      const requestedDay = warsawDay.format(new Date())
      setTotal(previous => previous?.purchaseDate === requestedDay ? previous : null)
      try {
        const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(requestTimeoutMs)])
        const result = await getDailyTotal(token, signal)
        if (lifetime.signal.aborted) return
        if (result === 'unauthorized') onEndSession(sessionEnded)
        else if (requestedDay === warsawDay.format(new Date())) {
          setTotal(result)
          setFailed(false)
        }
      } catch {
        if (!lifetime.signal.aborted) {
          setTotal(null)
          setFailed(true)
        }
      } finally {
        inFlight = false
        if (!lifetime.signal.aborted) {
          clearTimeout(timer)
          const crossedMidnight = requestedDay !== warsawDay.format(new Date())
          timer = setTimeout(refresh, crossedMidnight ? 0 : minuteMs - Date.now() % minuteMs)
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
  }, [token, attempt, onEndSession])

  return (
    <div className="registration-shell today-shell">
      <header className="today-nav"><Brand /><Button variant="outline" onPress={() => onEndSession()}>Log out</Button></header>
      <main className="today-main">
        <span className="eyebrow">DAILY OVERVIEW</span>
        <h1 ref={heading} tabIndex={-1}>Today’s spending</h1>
        <section className="total-card" aria-labelledby="total-label">
          <h2 id="total-label">Total spent today</h2>
          <div role="status" aria-live="polite" aria-atomic="true">
            {total ? <>
              <p className="daily-amount">{formatTotal(total.totalGrosz)}</p>
              <p className="total-date"><time dateTime={total.purchaseDate}>{displayDate.format(new Date(total.purchaseDate))}</time> · Warsaw</p>
              {total.totalGrosz === '0' && <p className="empty-day">No expenses recorded today.</p>}
            </> : failed ? <p>We couldn’t load today’s spending.</p> : <p>Loading today’s spending…</p>}
          </div>
          {failed && <Button variant="secondary" onPress={() => { setFailed(false); setAttempt(value => value + 1) }}>Try again</Button>}
        </section>
        <p className="daily-note">Includes all your purchases dated today in Warsaw.</p>
      </main>
    </div>
  )
}
