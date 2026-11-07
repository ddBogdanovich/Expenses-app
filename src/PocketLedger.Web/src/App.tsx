import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import TodayPage from './features/today/TodayPage'
import SessionNotice from './features/authentication/SessionNotice'
import type { ComponentProps } from 'react'
import { getSessionStatus, hostedEntry, submitLogout, type Destination } from './features/authentication/auth-api'
import { requestTimeoutMs } from './request-policy'

// Vite removes the reference route and its imports from production builds.
const DesignSystemRoute = import.meta.env.DEV ? lazy(() => import('./design-system/DesignSystemRoute')) : null
const sessionRecheckIntervalMs = 60_000

type Session = 'signed-out' | 'logging-out' | 'checking' | 'authorized' | 'unavailable' | 'expired' | 'logout-failed'

export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [session, setSession] = useState<Session>('checking')
  const [attempt, setAttempt] = useState(0)
  const previouslyVerified = useRef(window.history.state?.pocketledgerVerified === true)
  const loggingOut = useRef(false)
  const suspended = useRef(false)
  const verificationEpoch = useRef(0)
  const destination: Destination = DesignSystemRoute && (path === '/design-system' || path === '/auth/recovery' && new URLSearchParams(window.location.search).get('returnUrl') === '/design-system') ? '/design-system' : '/'
  const publicState = path === '/auth/recovery' ? new URLSearchParams(window.location.search).get('code') === 'auth.logout_incomplete' ? 'logout-failed' : 'recovery' : path === '/auth/signed-out' ? 'logged-out' : null

  const navigate = useCallback((nextPath: string) => {
    window.history.pushState(null, '', nextPath)
    setSession('checking')
    setPath(nextPath)
  }, [])

  useEffect(() => {
    const lifetime = new AbortController()
    let inFlight: AbortController | null = null
    async function verify() {
      if (suspended.current || publicState && publicState !== 'logged-out') return
      const epoch = verificationEpoch.current
      inFlight?.abort()
      const request = new AbortController()
      inFlight = request
      try {
        const signal = AbortSignal.any([lifetime.signal, request.signal, AbortSignal.timeout(requestTimeoutMs)])
        const status = await getSessionStatus(signal)
        if (lifetime.signal.aborted || request.signal.aborted || epoch !== verificationEpoch.current || suspended.current) return
        if (publicState === 'logged-out') {
          setSession(status === 'unauthorized' ? 'signed-out' : 'logout-failed')
        } else if (status === 'unauthorized') {
          if (previouslyVerified.current) setSession('expired')
          else window.location.replace(hostedEntry(path === '/register' ? 'register' : 'login', destination))
        } else {
          previouslyVerified.current = true
          // A non-secret history marker lets reload distinguish an ended session
          // from a first visit, without storing credentials or provider tokens.
          const protectedPath = path === '/login' || path === '/register' ? '/' : path
          window.history.replaceState({ pocketledgerVerified: true }, '', protectedPath)
          setPath(protectedPath)
          setSession('authorized')
        }
      } catch {
        if (!lifetime.signal.aborted && !request.signal.aborted && epoch === verificationEpoch.current && !suspended.current) setSession('unavailable')
      }
    }
    function recheck() {
      if (!document.hidden && !suspended.current) { setSession('checking'); void verify() }
    }
    function onPageShow() {
      if (loggingOut.current) { loggingOut.current = false; suspended.current = false }
      recheck()
    }
    function hide() {
      inFlight?.abort()
      if (!suspended.current) flushSync(() => setSession('checking'))
    }
    function onPopState() {
      hide()
      setPath(window.location.pathname)
      setAttempt(value => value + 1)
    }
    void verify()
    const timer = setInterval(() => void verify(), sessionRecheckIntervalMs)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('pagehide', hide)
    window.addEventListener('popstate', onPopState)
    document.addEventListener('visibilitychange', recheck)
    return () => {
      lifetime.abort()
      inFlight?.abort()
      clearInterval(timer)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('visibilitychange', recheck)
    }
  }, [path, destination, publicState, attempt])

  const endSession = useCallback((message?: string) => {
    verificationEpoch.current++
    suspended.current = true
    if (message) { setSession('expired'); return }
    if (loggingOut.current) return
    loggingOut.current = true
    setSession('logging-out')
    void submitLogout().catch(() => { loggingOut.current = false; setSession('logout-failed') })
  }, [])

  useEffect(() => {
    document.title = `${publicState === 'recovery' ? 'Login recovery' : publicState === 'logged-out' ? 'Logged out'
      : session !== 'authorized' ? 'Your session' : destination === '/design-system' ? 'Design reference' : 'Today'} · PocketLedger`
  }, [destination, session, publicState])

  let noticeState: ComponentProps<typeof SessionNotice>['state'] = session === 'authorized' || session === 'signed-out' ? 'checking' : session
  if (publicState === 'logged-out' && session === 'signed-out') noticeState = 'logged-out'
  else if (publicState && publicState !== 'logged-out' && session !== 'logging-out') noticeState = publicState

  function retry() {
    if (session === 'logout-failed' || publicState === 'logout-failed') endSession()
    else { setSession('checking'); setAttempt(value => value + 1) }
  }

  if (publicState || session !== 'authorized') return <SessionNotice state={noticeState} destination={destination} onRetry={retry} />

  if (destination === '/design-system' && DesignSystemRoute) return <Suspense fallback={<SessionNotice state="checking" destination={destination} onRetry={() => {}} />}>
    <DesignSystemRoute onBack={() => navigate('/')} onEndSession={endSession} />
  </Suspense>

  return <TodayPage onEndSession={endSession} onOpenDesignSystem={DesignSystemRoute ? () => navigate('/design-system') : undefined} />
}
