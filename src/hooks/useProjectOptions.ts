import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

// GET /master/projects/options — unpaginated, ordered by project_code. Default = ACTIVE + is_active.
export interface ProjectOptionRow {
  id: number
  project_code: string
  project_name: string
  customer_id: number | null
  customer_name: string | null
  job_codes: string[]
  project_kind: string
  status: string
  is_active: boolean
  warehouse_code: string | null
  linked_warehouse_code: string | null
}

export interface ProjectOptionsParams {
  search?: string
  include_closed?: boolean
  include_inactive?: boolean
  warehouse_only?: boolean
  exclude_warehouse?: boolean
}

export interface ProjectSelectOption {
  value: string
  label: string
  name: string
  jobCodes: string[]
  id: number
  status: string
}

// Cached per page load (per session) with a short TTL so a project created in the meantime shows up
// without a reload. Failures are not cached and just yield an empty list for the caller.
const CACHE_TTL_MS = 60_000
const cache = new Map<string, { at: number; rows: ProjectOptionRow[] }>()
const inflight = new Map<string, Promise<ProjectOptionRow[]>>()

const cacheKey = (p: ProjectOptionsParams) =>
  JSON.stringify([p.search ?? '', !!p.include_closed, !!p.include_inactive, !!p.warehouse_only, !!p.exclude_warehouse])

const loadProjectOptions = (token: string, p: ProjectOptionsParams): Promise<ProjectOptionRow[]> => {
  const key = cacheKey(p)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.rows)
  const running = inflight.get(key)
  if (running) return running
  const req = axios
    .get(`${BASE_URL}/master/projects/options`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        search: p.search || undefined,
        include_closed: p.include_closed || undefined,
        include_inactive: p.include_inactive || undefined,
        warehouse_only: p.warehouse_only || undefined,
        exclude_warehouse: p.exclude_warehouse || undefined,
      },
    })
    .then((res) => {
      const body = res.data?.data
      const rows: ProjectOptionRow[] = Array.isArray(body) ? body : []
      cache.set(key, { at: Date.now(), rows })
      return rows
    })
    .finally(() => { inflight.delete(key) })
  inflight.set(key, req)
  return req
}

const byCode = (a: ProjectOptionRow, b: ProjectOptionRow) => a.project_code.localeCompare(b.project_code)

/** "2026-LMT-001 - Project name" (select labels). */
export const projectOptionLabel = (p: Pick<ProjectOptionRow, 'project_code' | 'project_name'>) =>
  p.project_name ? `${p.project_code} - ${p.project_name}` : p.project_code

export const toProjectSelectOptions = (rows: ProjectOptionRow[]): ProjectSelectOption[] =>
  rows.map((p) => ({
    value: p.project_code,
    label: projectOptionLabel(p),
    name: p.project_name ?? '',
    jobCodes: Array.isArray(p.job_codes) ? p.job_codes : [],
    id: p.id,
    status: p.status,
  }))

/** antd <Select showSearch> filter: matches project code and name. */
export const projectSelectFilter = (input: string, option?: { label?: unknown; value?: unknown; name?: unknown }) => {
  const q = input.trim().toLowerCase()
  if (!q) return true
  return `${option?.value ?? ''} ${option?.name ?? ''} ${option?.label ?? ''}`.toLowerCase().includes(q)
}

/**
 * Project dropdown data. `ensureCode` = a project_code the form already holds (editing an old document):
 * when it is not in the list (CLOSED / INACTIVE project) it is fetched by code and merged in, so the field
 * keeps its real label instead of a raw code. New documents pass nothing and get the default list.
 */
export function useProjectOptions(params: ProjectOptionsParams = {}, ensureCode?: string | null) {
  const token = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const key = cacheKey(params)
  const [rows, setRows] = useState<ProjectOptionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [extra, setExtra] = useState<ProjectOptionRow | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setLoading(true)
    loadProjectOptions(token, params)
      .then((r) => { if (!cancelled) setRows(r) })
      .catch(() => { if (!cancelled) setRows([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key])

  const missing = !!ensureCode && !loading && !rows.some((r) => r.project_code === ensureCode)
  useEffect(() => {
    if (!token || !ensureCode || !missing) { setExtra(null); return }
    let cancelled = false
    loadProjectOptions(token, { search: ensureCode, include_closed: true, include_inactive: true })
      .then((r) => { if (!cancelled) setExtra(r.find((x) => x.project_code === ensureCode) ?? null) })
      .catch(() => { if (!cancelled) setExtra(null) })
    return () => { cancelled = true }
  }, [token, ensureCode, missing])

  const projects = useMemo(() => {
    const merged = extra && !rows.some((r) => r.project_code === extra.project_code) ? [...rows, extra] : rows
    return [...merged].sort(byCode)
  }, [rows, extra])

  const options = useMemo(() => toProjectSelectOptions(projects), [projects])
  return { projects, options, loading }
}
