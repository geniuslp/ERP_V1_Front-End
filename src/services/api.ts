import axios, { AxiosInstance, AxiosStatic, InternalAxiosRequestConfig } from 'axios'
import { store } from '@/store'
import { logout, setTokens } from '@/store/slices/authSlice'
import { appPath } from '@/config/env'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1'

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Plain client with no interceptors — used for the refresh call itself so a
// 401 there can't recurse back into the response interceptor below.
const bareClient: AxiosInstance = axios.create({ baseURL: BASE_URL, timeout: 15000 })

const redirectToLogin = (expired = false) => {
  store.dispatch(logout())
  if (expired) {
    try { sessionStorage.setItem('erp_session_expired', '1') } catch { /* ignore */ }
  }
  // Full-page redirect bypasses the router, so build the path under the current base.
  const loginPath = appPath('login')
  if (window.location.pathname !== loginPath) {
    window.location.href = loginPath
  }
}

const attachAuthHeader = (config: InternalAxiosRequestConfig) => {
  const state = store.getState()
  const token = state.auth.tokens?.accessToken
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
  return config
}

const GENERIC_ERROR_MESSAGE = 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'

// Raw Postgres/pgx error text (e.g. "ERROR: insert or update on table ... violates
// foreign key constraint ... SQLSTATE 23503") should never reach the UI — this is
// a catch-all safety net for cases the backend hasn't wrapped in a friendly message
// yet. Every page reads error text via err?.response?.data?.message / ?.error, so
// sanitizing it here in the shared interceptor covers all of them without having
// to touch each page's catch block individually.
const looksLikeRawDbError = (text: string) =>
  /SQLSTATE|violates|foreign key constraint|duplicate key|null value in column|pq:/i.test(text)

const sanitizeDbError = (error: unknown) => {
  const data = (error as { response?: { data?: { message?: unknown; error?: unknown } } })?.response?.data
  if (!data) return
  if (typeof data.message === 'string' && looksLikeRawDbError(data.message)) {
    data.message = GENERIC_ERROR_MESSAGE
  }
  if (typeof data.error === 'string' && looksLikeRawDbError(data.error)) {
    data.error = GENERIC_ERROR_MESSAGE
  }
}

// Flag read once by LoginPage to show a neutral "session expired" notice.
// sessionStorage survives the full-page redirect below.
export const SESSION_EXPIRED_KEY = 'erp_session_expired'

const isAuthEndpoint = (url?: string) => !!url && /\/auth\/(login|refresh)(\?|$)/.test(url)

// One in-flight refresh shared by every concurrent 401 — each waiter just awaits
// the same promise, then retries its own request with the new access token.
let refreshPromise: Promise<string> | null = null

const refreshAccessToken = (): Promise<string> => {
  if (refreshPromise) return refreshPromise
  const refreshToken = store.getState().auth.tokens?.refreshToken
  if (!refreshToken) return Promise.reject(new Error('no refresh token'))
  refreshPromise = bareClient
    .post('/auth/refresh', { refresh_token: refreshToken, refreshToken })
    .then((res) => {
      // Tolerate both { data: { access_token } } (login shape) and flat camelCase.
      const d = res.data?.data ?? res.data ?? {}
      const accessToken: string | undefined = d.access_token ?? d.accessToken
      const newRT: string = d.refresh_token ?? d.refreshToken ?? refreshToken
      if (!accessToken) throw new Error('invalid refresh response')
      store.dispatch(setTokens({ accessToken, refreshToken: newRT }))
      return accessToken
    })
    .finally(() => { refreshPromise = null })
  return refreshPromise
}

const attachInterceptors = (instance: AxiosInstance | AxiosStatic) => {
  instance.interceptors.request.use(attachAuthHeader, (error) => Promise.reject(error))

  instance.interceptors.response.use(
    (r) => r,
    async (error) => {
      sanitizeDbError(error)
      const original = error.config
      // Never refresh/retry for /auth/login or /auth/refresh (wrong password is a
      // plain error for the login form; a failed refresh is handled below).
      if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint(original.url)) {
        original._retry = true
        try {
          const token = await refreshAccessToken()
          original.headers.Authorization = `Bearer ${token}`
          return api(original)
        } catch (e) {
          redirectToLogin(true)
          return Promise.reject(e)
        }
      }
      return Promise.reject(error)
    }
  )
}

// Attach to the shared `api` instance AND the bare `axios` singleton — several
// pages call `axios.get/post` directly with a manually-built Authorization
// header instead of using `api`, and since they all import the same default
// axios export, this is the only way to give those calls 401 handling too.
attachInterceptors(api)
attachInterceptors(axios)

export default api
