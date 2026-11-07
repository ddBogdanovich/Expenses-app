import DesignSystemPage from './DesignSystemPage'

type Props = { onBack: () => void; onEndSession: (message?: string) => void }

// App verifies the cookie session before this development-only import is rendered,
// and clears this subtree whenever restoration, visibility or periodic checks fail.
export default function DesignSystemRoute(props: Props) {
  return <DesignSystemPage {...props} />
}
