import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n/I18nProvider'
import { DesktopProvider } from './components/desktop/DesktopProvider'
import { ToastProvider } from './components/toast/ToastProvider'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <DesktopProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </DesktopProvider>
    </I18nProvider>
  </StrictMode>,
)
