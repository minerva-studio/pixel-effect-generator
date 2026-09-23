import { useEffect, useRef, useState } from 'react'
import { GENERATOR_REGISTRY } from '../generators/registry'
import type { RegisteredGenerator } from '../generators/contract'
import { generatorDisplayKeys } from '../i18n/messages'
import { useI18n } from '../i18n/I18nProvider'
import { drawFrame } from './export'

/** Appearance choice stored for the app, independently of the open project. */
export type ThemePreference = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'pixel-effect-generator:theme'

/** Unknown or unavailable preferences follow the operating-system appearance. */
export function resolveThemePreference(stored: unknown): ThemePreference {
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

/** The project document never determines the interface appearance. */
export function resolveTheme(preference: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
}

/** Explicit theme preference shared by web and desktop, outside project serialization. */
export function ThemeToggle() {
  const { t } = useI18n()
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try { return resolveThemePreference(localStorage.getItem(THEME_STORAGE_KEY)) }
    catch { return 'system' }
  })
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const theme = resolveTheme(preference, media?.matches ?? false)
      document.documentElement.dataset.theme = theme
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1b1b1b' : '#eeeeee')
    }
    apply()
    try { localStorage.setItem(THEME_STORAGE_KEY, preference) } catch { /* Storage is optional. */ }
    if (preference === 'system') media?.addEventListener('change', apply)
    return () => { if (preference === 'system') media?.removeEventListener('change', apply) }
  }, [preference])
  return <select className="theme-select" aria-label={t('workbench.theme')} value={preference}
    onChange={(event) => setPreference(event.target.value as ThemePreference)}>
    <option value="system">{t('workbench.system')}</option>
    <option value="light">{t('workbench.light')}</option>
    <option value="dark">{t('workbench.dark')}</option>
  </select>
}

/** Native modal: picking a type creates a document; cancelling leaves the current one intact. */
export function NewDocumentDialog({ open, busy, onClose, onCreate }: {
  readonly open: boolean
  readonly busy: boolean
  readonly onClose: () => void
  readonly onCreate: (id: string) => Promise<boolean>
}) {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  return <dialog ref={dialog} className="new-document-dialog" aria-labelledby="new-document-title"
    onCancel={(event) => { event.preventDefault(); if (!pending) onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}>
    <header className="new-document-heading">
      <div><p className="section-label">PIXEL EFFECT GENERATOR</p><h2 id="new-document-title">{t('workbench.newTitle')}</h2><p>{t('workbench.newDescription')}</p></div>
      <button type="button" className="icon-button" disabled={pending} aria-label={t('workbench.close')} onClick={onClose}>×</button>
    </header>
    <div className="document-type-grid">
      {open && GENERATOR_REGISTRY.registrations.map((generator) => {
        const keys = generatorDisplayKeys(generator.id)!
        return <button type="button" className="document-type-card" key={generator.id} disabled={busy || pending}
          onClick={async () => {
            setPending(true)
            try { if (await onCreate(generator.id)) onClose() }
            finally { setPending(false) }
          }}>
          <GeneratorThumbnail generator={generator} />
          <strong>{t(keys.name)}</strong><span>{t(keys.description)}</span>
          <small>{t('workbench.create')} <span aria-hidden="true">↗</span></small>
        </button>
      })}
    </div>
  </dialog>
}

function GeneratorThumbnail({ generator }: { readonly generator: RegisteredGenerator<string> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvas.current) return
    const frames = generator.createSession(12).frames.read()
    drawFrame(canvas.current, frames[Math.floor(frames.length / 3)])
  }, [generator])
  return <div className="document-type-art"><canvas ref={canvas} aria-hidden="true" /></div>
}
