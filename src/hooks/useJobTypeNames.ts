import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

export interface JobTypeApiRow {
  job_code: string
  job_name: string
  needs_share?: boolean
}

// GET /master/job-types, cached per page load. Names are display-only (Work Order
// work_system labels); a failed load just leaves the map empty so callers fall back to codes.
let cache: JobTypeApiRow[] | null = null
let inflight: Promise<JobTypeApiRow[]> | null = null

const loadJobTypes = (token: string): Promise<JobTypeApiRow[]> => {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = axios
      .get(`${BASE_URL}/master/job-types`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const body = res.data?.data ?? res.data
        cache = Array.isArray(body) ? body : []
        return cache
      })
      .catch(() => [] as JobTypeApiRow[])
      .finally(() => { inflight = null })
  }
  return inflight
}

export function useJobTypes(): JobTypeApiRow[] {
  const token = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [rows, setRows] = useState<JobTypeApiRow[]>(cache ?? [])
  useEffect(() => {
    if (!token) return
    let cancelled = false
    loadJobTypes(token).then((r) => { if (!cancelled) setRows(r) })
    return () => { cancelled = true }
  }, [token])
  return rows
}

export function useJobTypeNames(): Record<string, string> {
  const rows = useJobTypes()
  return Object.fromEntries(rows.map((r) => [r.job_code, r.job_name]))
}
