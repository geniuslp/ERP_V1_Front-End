import axios from 'axios'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080/api/v1'

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

// GET/POST/PUT/DELETE /departments — responses are { success, data }.
// dept_code is immutable after create; delete returns 409 (Thai message) while the department is in use.
export interface Department {
  id: number
  dept_code: string
  dept_name: string
  sort_order: number
  is_active: boolean
}

export interface DepartmentPayload {
  dept_code: string
  dept_name: string
  sort_order: number
  is_active: boolean
}

export const departmentService = {
  async list(token: string, activeOnly = false): Promise<Department[]> {
    const res = await axios.get(`${BASE_URL}/departments`, {
      headers: authHeader(token),
      params: activeOnly ? { active_only: true } : undefined,
    })
    const body = res.data?.data ?? res.data
    return Array.isArray(body) ? body : []
  },

  async create(token: string, payload: DepartmentPayload): Promise<Department> {
    const res = await axios.post(`${BASE_URL}/departments`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  async update(token: string, id: number, payload: DepartmentPayload): Promise<Department> {
    const res = await axios.put(`${BASE_URL}/departments/${id}`, payload, { headers: authHeader(token) })
    return res.data?.data ?? res.data
  },

  async remove(token: string, id: number): Promise<void> {
    await axios.delete(`${BASE_URL}/departments/${id}`, { headers: authHeader(token) })
  },
}

export const departmentErrorMessage = (err: any, fallback: string): string =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback
