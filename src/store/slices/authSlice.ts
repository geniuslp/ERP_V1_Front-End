import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { AuthState, AuthTokens, User } from '@/types'

const STORAGE_KEY = 'erp_tokens'
const USER_STORAGE_KEY = 'erp_user'

const loadTokens = (): AuthTokens | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const loadUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const initialState: AuthState = {
  user: loadUser(),
  tokens: loadTokens(),
  isAuthenticated: !!loadTokens(),
  isLoading: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.isLoading = true
    },
    loginSuccess(state, action: PayloadAction<{ user: User; tokens: AuthTokens }>) {
      state.user = action.payload.user
      state.tokens = action.payload.tokens
      state.isAuthenticated = true
      state.isLoading = false
      localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload.tokens))
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(action.payload.user))
    },
    loginFailure(state) {
      state.isLoading = false
    },
    logout(state) {
      state.user = null
      state.tokens = null
      state.isAuthenticated = false
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(USER_STORAGE_KEY)
    },
    setTokens(state, action: PayloadAction<AuthTokens>) {
      state.tokens = action.payload
      localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload))
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(action.payload))
    },
  },
})

export const { loginStart, loginSuccess, loginFailure, logout, setTokens, setUser } = authSlice.actions
export default authSlice.reducer
