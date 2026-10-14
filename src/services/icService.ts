import axios from 'axios'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

export interface ICPreparer {
  id: number
  username: string
  full_name: string
  department?: string | null
}

export const icService = {
  // Users allowed to open the IC pages (effective read on MENU_IC_PROJECT), sorted by username.
  getPreparers: async (token: string): Promise<ICPreparer[]> => {
    const res = await axios.get(`${BASE_URL}/ic/preparers`, { headers: { Authorization: `Bearer ${token}` } })
    const raw = res.data?.data ?? res.data
    return Array.isArray(raw) ? raw : []
  },
}
