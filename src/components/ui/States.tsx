import type { ReactNode } from 'react'

export function LoadingState({ label = 'Loading inventory…' }: { label?: string }) {
  return (
    <div className="state">
      <div className="state__spinner" aria-hidden />
      <p className="muted">{label}</p>
    </div>
  )
}

export function ErrorState({
  message,
  action,
}: {
  message: string
  action?: ReactNode
}) {
  return (
    <div className="state">
      <div className="state__icon state__icon--warn">!</div>
      <p className="soft" style={{ maxWidth: 460, textAlign: 'center' }}>
        {message}
      </p>
      {action}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="state">
      <div className="state__icon">∅</div>
      <h3>{title}</h3>
      {hint && <p className="muted">{hint}</p>}
    </div>
  )
}
