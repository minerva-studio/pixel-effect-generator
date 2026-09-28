import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { RegisteredGenerator, RegisteredGeneratorSession } from '../generators/contract'
import { useI18n } from '../i18n/I18nProvider'
import { nextMenuIndex } from './desktop/DesktopTitleBar'
import { formatRoute, shareBaseUrl } from './generatorRoute'
import { encodeEffectLink } from './shareLink'
import { useToast } from './toast/ToastProvider'

/** Share menu: copies the generator entry or a snapshot of the current effect, built only on click. */
export function ShareMenu({ generator, session, isDesktop, align = 'end' }: {
  readonly generator: RegisteredGenerator<string>
  readonly session: RegisteredGeneratorSession<string>
  readonly isDesktop: boolean
  /** Which edge of the button the menu panel lines up with. */
  readonly align?: 'start' | 'end'
}) {
  const { t } = useI18n()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [manualLink, setManualLink] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    menuButtons(panelRef.current)[0]?.focus()
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }
  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const buttons = menuButtons(panelRef.current)
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        buttons[nextMenuIndex(current, buttons.length, 1)]?.focus()
        break
      case 'ArrowUp':
        event.preventDefault()
        buttons[nextMenuIndex(current, buttons.length, -1)]?.focus()
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }
  const copy = async (effect: boolean) => {
    setOpen(false)
    let link: string
    try {
      const fragment = formatRoute(generator.id, effect ? encodeEffectLink(generator, session.parameters, session.previewFps) : null)
      link = `${shareBaseUrl(isDesktop, window.location)}${fragment}`
    } catch {
      toast.show('error', t('share.encodeFailed'))
      return
    }
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(link)
      toast.show('success', t('share.copied'))
    } catch {
      setManualLink(link)
    }
  }

  return <div className="share-menu" ref={rootRef}>
    <button ref={buttonRef} className="toolbar-button" type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => setOpen((value) => !value)}>{t('share.button')}</button>
    {open && <div ref={panelRef} id={menuId} className={`project-menu-panel${align === 'start' ? ' share-menu-panel-start' : ''}`} role="menu" aria-label={t('share.menuLabel')} onKeyDown={handleMenuKeyDown}>
      <button className="project-menu-item" type="button" role="menuitem" title={t('share.effectHint')} disabled={!generator.shareCodec} onClick={() => void copy(true)}>{t('share.effect')}</button>
      <button className="project-menu-item" type="button" role="menuitem" title={t('share.generatorHint')} onClick={() => void copy(false)}>{t('share.generator')}</button>
    </div>}
    <ManualCopyDialog link={manualLink} onClose={() => { setManualLink(null); buttonRef.current?.focus() }} />
  </div>
}

/** Fallback when the clipboard is unavailable: a pre-selected read-only link. */
function ManualCopyDialog({ link, onClose }: { readonly link: string | null; readonly onClose: () => void }) {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (link === null) {
      dialog.current?.close()
      return
    }
    dialog.current?.showModal()
    input.current?.select()
  }, [link])
  return <dialog ref={dialog} className="share-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header className="new-document-heading">
      <div><h2 id={titleId}>{t('share.manualTitle')}</h2><p>{t('share.copyFailed')}</p></div>
      <button type="button" className="icon-button" aria-label={t('share.close')} onClick={onClose}>×</button>
    </header>
    <input ref={input} className="share-link-input" type="text" readOnly value={link ?? ''} aria-label={t('share.linkLabel')} title={t('share.manualHint')} onFocus={(event) => event.target.select()} />
  </dialog>
}

function menuButtons(panel: HTMLDivElement | null): HTMLButtonElement[] {
  return panel === null ? [] : Array.from(panel.querySelectorAll<HTMLButtonElement>('button')).filter((button) => !button.disabled)
}
