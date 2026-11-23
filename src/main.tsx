import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/services/api'
import { startActionButtonTint } from '@/utils/actionButtonTint'

startActionButtonTint()

// Warm up the self-hosted print font (see @font-face in index.css) so print layouts that measure
// text height never run before it has loaded. Failure is harmless (falls back to sans-serif).
try {
  void document.fonts?.load("12pt 'Cordia New'")
  void document.fonts?.load("bold 12pt 'Cordia New'")
} catch { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
