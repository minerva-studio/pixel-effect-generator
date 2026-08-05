import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../i18n/I18nProvider'

export type ToastKind = 'pending' | 'success' | 'error'

export interface ToastMessage {
  readonly id: number
  readonly kind: ToastKind
  readonly message: string
}

export interface ToastApi {
  readonly show: (kind: ToastKind, message: string) => number
  readonly dismiss: (id: number) => void
}

/** Pure toast list transitions used by the provider and tests. */
export type ToastReducerAction =
  | { readonly type: 'add'; readonly toast: ToastMessage }
  | { readonly type: 'dismiss'; readonly id: number }

export function toastReducer(
  state: readonly ToastMessage[],
  action: ToastReducerAction,
): readonly ToastMessage[] {
  switch (action.type) {
    case 'add':
      return [...state, action.toast]
    case 'dismiss':
      return state.filter((toast) => toast.id !== action.id)
  }
}

const ToastContext = createContext<ToastApi | null>(null)

const SUCCESS_DISMISS_MS = 3000

/** Global operation feedback: pending, transient success, and sticky errors. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((kind: ToastKind, message: string): number => {
    const id = nextId.current
    nextId.current += 1
    setToasts((current) => [...current, { id, kind, message }])
    return id
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  readonly toasts: readonly ToastMessage[]
  readonly onDismiss: (id: number) => void
}) {
  const { t } = useI18n()
  useEffect(() => {
    const timers = toasts
      .filter((toast) => toast.kind === 'success')
      .map((toast) => window.setTimeout(() => onDismiss(toast.id), SUCCESS_DISMISS_MS))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [toasts, onDismiss])

  if (toasts.length === 0) {
    return null
  }
  return (
    <div className="toast-viewport" role="region" aria-label={t('toast.label')}>
      {toasts.map((toast) => (
        <div
          className={`toast toast-${toast.kind}`}
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : toast.kind === 'success' ? 'status' : undefined}
          aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        >
          {toast.kind === 'pending' ? <span className="toast-spinner" aria-hidden="true" /> : null}
          <span className="toast-message">{toast.message}</span>
          {toast.kind !== 'pending' ? (
            <button className="toast-close" type="button" aria-label={t('toast.dismiss')} onClick={() => onDismiss(toast.id)}>
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** Returns the toast API; a safe no-op outside the provider. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  const noop = useCallback(() => 0, [])
  return api ?? { show: noop, dismiss: noop }
}
