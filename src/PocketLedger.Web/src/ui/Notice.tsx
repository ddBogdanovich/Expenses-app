import type { ReactNode } from 'react'

type Props = {
  tone: 'info' | 'danger' | 'success'
  children: ReactNode
  announce?: boolean
}

export default function Notice({ tone, children, announce = true }: Props) {
  return <p className={`notice notice--${tone}`} role={announce ? tone === 'danger' ? 'alert' : 'status' : undefined}>{children}</p>
}
