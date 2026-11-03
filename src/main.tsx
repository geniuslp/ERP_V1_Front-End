import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@/services/api'
import { startActionButtonTint } from '@/utils/actionButtonTint'

startActionButtonTint()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
