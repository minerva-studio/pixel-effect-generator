import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesktopAppApi } from './desktop/desktopApi'
import type { RegisteredGeneratorAction, RegisteredGeneratorSession } from './generators/contract'
import { useI18n } from './i18n/I18nProvider'
import { LOCALE_DISPLAY_NAMES, SUPPORTED_LOCALES, isSupportedLocale } from './i18n/locales'
import { generatorDisplayKeys } from './i18n/messages'
import { DesktopTitleBar } from './components/desktop/DesktopTitleBar'
import { useDesktopApp } from './components/desktop/DesktopProvider'
import { serializeProjectSnapshot, useProjectWorkflow } from './components/desktop/useProjectWorkflow'
import { useFileOperationController } from './components/fileOperations'
import { useToast } from './components/toast/ToastProvider'
import { ThemeToggle, NewDocumentDialog } from './components/Workbench'
import { documentGenerator, prepareNewDocument, prepareOpenedDocument, type PreparedDocument } from './components/documentSession'
import { downloadText } from './components/export'
import { formatRoute, parseRoute, resolveRouteDocument, type RouteResolution } from './components/generatorRoute'
import { ShareMenu } from './components/ShareMenu'
import type { UnityExportSettingsState } from './components/unitySettings'
import { GENERATOR_REGISTRY } from './generators/registry'

export default function App() {
  const api = useDesktopApp()
  return api === null ? <WebApp /> : <DesktopApp api={api} />
}

function WebApp() {
  const { t } = useI18n()
  const toast = useToast()
  const [initialRoute] = useState<RouteResolution>(() => resolveRouteDocument(typeof window === 'undefined' ? '' : window.location.hash))
  const document = useDocumentSession(initialRoute.kind === 'default' ? undefined : initialRoute.document)
  // The effect snapshot currently shown in the address bar; cleared once the document diverges from it.
  const routeEffect = useRef(initialRoute.kind === 'effect' ? initialRoute.route.effect : null)
  const [newOpen, setNewOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const serialized = serializeProjectSnapshot(document.generator.projectCodec, document.session.parameters, document.session.previewFps, document.unitySettings)
  const [baseline, setBaseline] = useState(serialized)
  const dirty = serialized !== baseline
  const fileInput = useRef<HTMLInputElement>(null)
  const Workspace = document.generator.Workspace
  const busy = document.fileOperations.activeTask !== null
  const confirmReplace = () => !dirty || window.confirm(t('workbench.discard'))
  const acceptDocument = (next: PreparedDocument, name: string | null, effect: string | null = null) => {
    const generator = documentGenerator(next.session.generatorId)
    setBaseline(serializeProjectSnapshot(generator.projectCodec, next.session.parameters, next.session.previewFps, next.unitySettings))
    document.replace(next)
    setFileName(name)
    routeEffect.current = effect
    replaceRoute(formatRoute(generator.id, effect))
  }
  const { dispatch: dispatchSession } = document
  const dispatch = useCallback((action: RegisteredGeneratorAction<string>) => {
    const type = action.action.type
    if (routeEffect.current !== null && (type === 'parameters' || type === 'fps' || type === 'importProject')) {
      routeEffect.current = null
      replaceRoute(formatRoute(action.generatorId))
    }
    dispatchSession(action)
  }, [dispatchSession])
  const save = () => {
    if (!document.generator.projectCodec || !document.fileOperations.tryStart('projectSave')) return
    try {
      if (!serialized) throw new Error('Invalid project settings')
      const name = fileName ?? `${document.generator.id}.json`
      downloadText(serialized, name, 'application/json')
      setFileName(name)
      setBaseline(serialized)
      toast.show('success', t('desktop.toasts.savedProject'))
    } catch { toast.show('error', t('desktop.toasts.saveFailed')) }
    finally { document.fileOperations.finish('projectSave') }
  }
  const reportedInitialRoute = useRef(false)
  useEffect(() => {
    if (reportedInitialRoute.current || initialRoute.kind !== 'invalidEffect') return
    reportedInitialRoute.current = true
    replaceRoute(formatRoute(initialRoute.route.generatorId))
    toast.show('error', t('share.invalidLink'))
  }, [initialRoute, toast, t])
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseRoute(window.location.hash)
      const currentId = document.generator.id
      const targetId = route?.generatorId ?? GENERATOR_REGISTRY.registrations[0].id
      if ((route === null || route.effect === null) && targetId === currentId) {
        routeEffect.current = null
        return
      }
      const resolution = route === null ? null : resolveRouteDocument(window.location.hash)
      if (resolution?.kind === 'invalidEffect') toast.show('error', t('share.invalidLink'))
      if (!confirmReplace()) {
        replaceRoute(formatRoute(currentId, routeEffect.current))
        return
      }
      try {
        if (resolution === null || resolution.kind === 'default') acceptDocument(prepareNewDocument(targetId), null)
        else acceptDocument(resolution.document, null, resolution.kind === 'effect' ? resolution.route.effect : null)
      } catch { toast.show('error', t('workbench.newFailed')) }
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  })
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  return <main className="app-shell web-app-shell">
    <header className="workbench-header">
      <div className="workbench-brand"><img className="brand-mark" src={`${import.meta.env.BASE_URL}effect-mark.svg`} alt="" /><h1>{t('app.title')}</h1></div>
      <div className="header-preferences"><LanguageSelect /><ThemeToggle /></div>
    </header>
    <div className="document-toolbar">
      <div className="document-actions">
        <button className="toolbar-button" type="button" disabled={busy} onClick={() => setNewOpen(true)}><span aria-hidden="true">＋</span> {t('workbench.new')}</button>
        <button className="toolbar-button" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{t('desktop.titleBar.openProject')}</button>
        <button className="toolbar-button" type="button" disabled={busy || !document.generator.projectCodec} title={!document.generator.projectCodec ? t('workbench.noProjectSave') : undefined} onClick={save}>{t('desktop.titleBar.save')}</button>
        <ShareMenu generator={document.generator} session={document.session} isDesktop={false} align="start" />
      </div>
      <DocumentIdentity name={fileName ?? t('workbench.untitled')} generatorId={document.generator.id} dirty={dirty} />
      <button className="primary-button toolbar-export" id="web-export-button" type="button" aria-haspopup="dialog" aria-expanded={exportOpen} onClick={() => setExportOpen(true)}>{t('desktop.titleBar.export')} <span aria-hidden="true">↗</span></button>
      <input type="file" ref={fileInput} hidden accept=".json,application/json" aria-label={t('project.fileLabel')} onChange={async (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file || !document.fileOperations.tryStart('projectLoad')) return
        try {
          const next = prepareOpenedDocument(await file.text())
          if (confirmReplace()) acceptDocument(next, file.name)
        } catch { toast.show('error', t('workbench.openFailed')) }
        finally { document.fileOperations.finish('projectLoad') }
      }} />
    </div>
    <Workspace key={document.revision} session={document.session} onSessionAction={dispatch}
      unitySettings={document.unitySettings} onUnitySettingsChange={document.setUnitySettings} fileOperations={document.fileOperations}
      desktopExportOpen={exportOpen} onCloseDesktopExport={() => { setExportOpen(false); window.document.getElementById('web-export-button')?.focus() }} />
    <NewDocumentDialog open={newOpen} busy={busy} onClose={() => setNewOpen(false)} onCreate={async (id) => {
      if (busy || !confirmReplace()) return false
      try { acceptDocument(prepareNewDocument(id), null); return true }
      catch { toast.show('error', t('workbench.newFailed')); return false }
    }} />
    <footer className="web-footer">
      <span>Minerva Game Studio</span>
      <a href="https://github.com/minerva-studio/PixelEffectGenerator" target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
    </footer>
  </main>
}

function DesktopApp({ api }: { readonly api: DesktopAppApi }) {
  const { t } = useI18n()
  const toast = useToast()
  const document = useDocumentSession()
  const [newOpen, setNewOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const Workspace = document.generator.Workspace
  const requestNew = useCallback(() => setNewOpen(true), [])
  const workflow = useProjectWorkflow({
    api, generator: document.generator, session: document.session, unitySettings: document.unitySettings,
    onRequestNew: requestNew, onReplaceDocument: document.replace, fileOperations: document.fileOperations, toast, t,
  })
  const closeExport = useCallback(() => {
    setExportOpen(false)
    window.document.getElementById('desktop-export-button')?.focus()
  }, [])
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.code !== 'Space' || target?.closest('input, button, select, textarea, [role="separator"], dialog, [role="dialog"]') || newOpen || exportOpen) return
      event.preventDefault()
      document.dispatch({ generatorId: document.generator.id, action: { type: 'play', isPlaying: !document.session.isPlaying } })
    }
    window.document.addEventListener('keydown', handleKeyDown)
    return () => window.document.removeEventListener('keydown', handleKeyDown)
  }, [document.dispatch, document.generator.id, document.session.isPlaying, newOpen, exportOpen])
  return <div className="desktop-shell">
    <DesktopTitleBar workflow={workflow} busy={document.fileOperations.activeTask !== null} exportOpen={exportOpen} onExport={() => setExportOpen(true)} />
    <main className="app-shell desktop-app-shell">
      <div className="document-toolbar desktop-document-toolbar">
        <button className="toolbar-button" type="button" disabled={document.fileOperations.activeTask !== null} onClick={workflow.newProject}>＋ {t('workbench.new')}</button>
        <DocumentIdentity name={workflow.currentFileName ?? t('workbench.untitled')} generatorId={document.generator.id} dirty={workflow.dirty} />
        <ShareMenu generator={document.generator} session={document.session} isDesktop />
        <ThemeToggle />
      </div>
    <Workspace key={document.revision} session={document.session} onSessionAction={document.dispatch}
        unitySettings={document.unitySettings} onUnitySettingsChange={document.setUnitySettings} fileOperations={document.fileOperations}
        desktopExportOpen={exportOpen} onCloseDesktopExport={closeExport} />
      <NewDocumentDialog open={newOpen} busy={document.fileOperations.activeTask !== null} onClose={() => setNewOpen(false)} onCreate={workflow.createProject} />
    </main>
  </div>
}

function DocumentIdentity({ name, generatorId, dirty }: { readonly name: string; readonly generatorId: string; readonly dirty: boolean }) {
  const { t } = useI18n()
  const keys = generatorDisplayKeys(generatorId)
  return <div className="document-identity"><strong>{name}</strong>{dirty && <span className="document-dirty" aria-label={t('desktop.titleBar.unsaved')}>●</span>}<span className="document-type-badge">{keys ? t(keys.name) : generatorId}</span></div>
}

function LanguageSelect() {
  const { t, locale, setLocale } = useI18n()
  return <select className="language-select" aria-label={t('app.languageLabel')} value={locale} onChange={(event) => { if (isSupportedLocale(event.target.value)) setLocale(event.target.value) }}>
    {SUPPORTED_LOCALES.map((option) => <option value={option} key={option}>{LOCALE_DISPLAY_NAMES[option]}</option>)}
  </select>
}

/** Rewrites the address-bar fragment without adding a browser history entry. */
function replaceRoute(fragment: string) {
  if (window.location.hash !== fragment) window.history.replaceState(window.history.state, '', fragment)
}

/** One live document. Replacement is atomic and resets workspace-local view state even for the same type. */
function useDocumentSession(initial?: PreparedDocument) {
  const [document, setDocument] = useState(() => ({ ...(initial ?? prepareNewDocument(GENERATOR_REGISTRY.registrations[0].id)), revision: 0 }))
  const fileOperations = useFileOperationController()
  const generator = documentGenerator(document.session.generatorId)
  const replace = useCallback((next: PreparedDocument) => setDocument((current) => ({ ...next, revision: current.revision + 1 })), [])
  const dispatch = useCallback((action: RegisteredGeneratorAction<string>) => {
    setDocument((current) => {
      if (action.generatorId !== current.session.generatorId) return current
      return { ...current, session: documentGenerator(action.generatorId).reduceSession(current.session, action) }
    })
  }, [])
  const setUnitySettings = useCallback((unitySettings: UnityExportSettingsState) => setDocument((current) => ({ ...current, unitySettings })), [])
  return { ...document, generator, replace, dispatch, setUnitySettings, fileOperations }
}
