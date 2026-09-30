// Build-time environment flags — set via VITE_* vars (see .env.example).
// Defaults reproduce the existing prod behaviour exactly.

export const APP_ENV: string = import.meta.env.VITE_APP_ENV ?? 'prod'

// Empty prefix = existing prod storage keys stay unchanged.
export const STORAGE_PREFIX: string = import.meta.env.VITE_STORAGE_PREFIX ?? ''

export const storageKey = (k: string): string => `${STORAGE_PREFIX}${k}`

// Router basename: Vite's BASE_URL ('/erp/', '/erp/uat/') without the trailing slash.
export const ROUTER_BASENAME: string = import.meta.env.BASE_URL.replace(/\/+$/, '')

// Absolute path under the current base, e.g. appPath('login') → '/erp/login'.
export const appPath = (p: string): string =>
  `${import.meta.env.BASE_URL}${p.replace(/^\/+/, '')}`
