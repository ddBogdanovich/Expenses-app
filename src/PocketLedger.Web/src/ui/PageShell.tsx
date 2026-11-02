import type { ReactNode } from 'react'
import Brand from '../Brand'

type Props = {
  children: ReactNode
  headerAction?: ReactNode
  footer?: ReactNode
}

export default function PageShell({ children, headerAction, footer }: Props) {
  return (
    <div className="page-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="page-header"><Brand />{headerAction}</header>
      {children}
      {footer && <footer className="page-footer">{footer}</footer>}
    </div>
  )
}
