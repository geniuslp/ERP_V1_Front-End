import axios, { AxiosInstance, AxiosStatic, InternalAxiosRequestConfig } from 'axios'
import { store } from '@/store'
import { logout, setTokens } from '@/store/slices/authSlice'

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

const redirectToLogin = () => {
  store.dispatch(logout())
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

const attachAuthHeader = (config: InternalAxiosRequestConfig) => {
  const state = store.getState()
  const token = state.auth.tokens?.accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
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

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

const attachInterceptors = (instance: AxiosInstance | AxiosStatic) => {
  instance.interceptors.request.use(attachAuthHeader, (error) => Promise.reject(error))

  instance.interceptors.response.use(
    (r) => r,
    async (error) => {
      sanitizeDbError(error)
      const original = error.config
      if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/login')) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
            .then((token) => { original.headers.Authorization = `Bearer ${token}`; return api(original) })
        }
        original._retry = true
        isRefreshing = true
        const refreshToken = store.getState().auth.tokens?.refreshToken
        if (!refreshToken) {
          isRefreshing = false
          redirectToLogin()
          return Promise.reject(error)
        }
        try {
          const res = await bareClient.post('/auth/refresh', { refreshToken })
          const { accessToken, refreshToken: newRT } = res.data
          store.dispatch(setTokens({ accessToken, refreshToken: newRT }))
          processQueue(null, accessToken)
          original.headers.Authorization = `Bearer ${accessToken}`
          return api(original)
        } catch (e) {
          processQueue(e, null)
          redirectToLogin()
          return Promise.reject(e)
        } finally {
          isRefreshing = false
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
