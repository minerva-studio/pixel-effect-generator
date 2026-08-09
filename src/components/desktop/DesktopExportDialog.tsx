import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../../i18n/I18nProvider'

interface DesktopExportDialogProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly children: ReactNode
}

/** Desktop-only modal host that keeps export controls mounted between openings. */
export function DesktopExportDialog({ open, onClose, children }: DesktopExportDialogProps) {
  const { t } = useI18n()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return undefined
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Tab') {
        // Keep keyboard navigation inside the modal while preserving native tab order.
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  return (
    <div
      className="desktop-export-backdrop"
      hidden={!open}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="desktop-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-export-title"
        ref={dialogRef}
      >
        <div className="desktop-export-heading">
          <h2 id="desktop-export-title">{t('export.title')}</h2>
          <button
            className="desktop-export-close"
            type="button"
            ref={closeButtonRef}
            aria-label={t('desktop.titleBar.closeExport')}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="desktop-export-content">{children}</div>
      </div>
    </div>
  )
}
