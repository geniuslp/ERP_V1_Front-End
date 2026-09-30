import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Guarantee a leading and trailing slash ('erp/uat' → '/erp/uat/').
const normalizeBase = (p: string) => `/${p.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')

  // Safety check: a UAT build must never be pointed at the prod API.
  if ((process.env.VITE_APP_ENV || fileEnv.VITE_APP_ENV) === 'uat') {
    const apiUrl = process.env.VITE_API_URL || fileEnv.VITE_API_URL
    if (!apiUrl || !apiUrl.startsWith('/erp/uat/')) {
      throw new Error(
        `[vite.config] VITE_APP_ENV=uat requires VITE_API_URL to be set and start with "/erp/uat/" ` +
        `(e.g. /erp/uat/api/v1), got: ${apiUrl ? `"${apiUrl}"` : '(empty)'}`,
      )
    }
  }

  return {
    base: normalizeBase(process.env.VITE_BASE_PATH || fileEnv.VITE_BASE_PATH || '/erp/'),
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      watch: {
        usePolling: true,      // ← สำคัญมาก
        interval: 500,
      },
    },
  }
})