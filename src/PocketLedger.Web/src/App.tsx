import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import AccountPage from './features/authentication/AccountPage'
import TodayPage from './features/today/TodayPage'

// Vite removes the reference route and its imports from production builds.
const DesignSystemRoute = import.meta.env.DEV
  ? lazy(() => import('./design-system/DesignSystemRoute'))
  : null

const PreviewRoute = import.meta.env.DEV
  ? lazy(() => import('./features/authentication/PreviewPage'))
  : null

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [path, setPath] = useState(window.location.pathname)
  const returnToReference = useRef(Boolean(DesignSystemRoute && path === '/design-system'))
  const mode = path === '/register' ? 'register' : 'login'
  const referenceOpen = Boolean(DesignSystemRoute && path === '/design-system')

  const navigate = useCallback((nextPath: string, replace = false) => {
    if (replace) window.history.replaceState(null, '', nextPath)
    else window.history.pushState(null, '', nextPath)
    setPath(nextPath)
  }, [])

  useEffect(() => {
    function onPopState() {
      const nextPath = window.location.pathname
      if (!accessToken && nextPath !== '/register' && !(PreviewRoute && nextPath === '/preview')) navigate('/login', true)
      else setPath(nextPath)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [accessToken, navigate])

  useEffect(() => {
    if (PreviewRoute && path === '/preview') { document.title = 'Keycloak preview · PocketLedger'; return }
    if (!accessToken && mode === 'login') window.history.replaceState(null, '', '/login')
    document.title = `${accessToken ? referenceOpen ? 'Design reference' : 'Today' : mode === 'register' ? 'Create your account' : 'Log in'} · PocketLedger`
  }, [accessToken, mode, referenceOpen, path])

  const endSession = useCallback((message = '') => {
    returnToReference.current = false
    navigate('/login', true)
    setNotice(message)
    setAccessToken(null)
  }, [navigate])

  function startSession(token: string) {
    navigate(returnToReference.current ? '/design-system' : '/', true)
    returnToReference.current = false
    setAccessToken(token)
    setNotice('')
  }

  if (PreviewRoute && path === '/preview') return <Suspense fallback={<p role="status">Loading preview…</p>}><PreviewRoute /></Suspense>

  if (!accessToken) return <AccountPage mode={mode} onAuthenticated={startSession} notice={notice} />

  if (referenceOpen && DesignSystemRoute) {
    return <Suspense fallback={<p role="status">Loading design reference…</p>}>
      <DesignSystemRoute token={accessToken} onBack={() => navigate('/')} onEndSession={endSession} />
    </Suspense>
  }

  return <TodayPage token={accessToken} onEndSession={endSession}
    onOpenDesignSystem={DesignSystemRoute ? () => navigate('/design-system') : undefined} />
}
