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
