import { useEffect, useState } from 'react'
import { useAppSelector } from '@/store'
import { departmentService, type Department } from '@/services/departmentService'

// Department master names, used only when GET /departments fails (never invented beyond this list).
export const FALLBACK_DEPARTMENTS: Department[] = [
  ['FN', 'Financial'],
  ['HR', 'Human Resource'],
  ['BD', 'Business Development'],
  ['CS', 'Corporate Service'],
  ['SC', 'Supply Chain'],
  ['PD', 'Production'],
  ['PJ', 'Project'],
  ['PS', 'Project Support'],
].map(([dept_code, dept_name], i) => ({ id: -(i + 1), dept_code, dept_name, sort_order: i, is_active: true }))

// One fetch per page session and mode; a failed fetch is not cached so a later mount retries.
const cache: { active: Promise<Department[]> | null; all: Promise<Department[]> | null } = { active: null, all: null }

/**
 * includeInactive=false (default): GET /departments?active_only=true — for document forms.
 * includeInactive=true: GET /departments (every row, is_active tells which are deactivated) — for admin screens.
 */
export function useDepartments(includeInactive = false) {
  const token = useAppSelector((s) => s.auth.tokens?.accessToken) ?? ''
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const key = includeInactive ? 'all' : 'active'
    if (!cache[key]) cache[key] = departmentService.list(token, !includeInactive)
    const p = cache[key]!
    setLoading(true)
    p.then((list) => {
      if (cancelled) return
      setDepartments(list)
      setUsingFallback(false)
    })
      .catch((err) => {
        cache[key] = null
        console.error('[useDepartments] GET /departments failed, using the static master list', err)
        if (cancelled) return
        setDepartments(FALLBACK_DEPARTMENTS)
        setUsingFallback(true)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, includeInactive])

  return { departments, loading, usingFallback }
}
