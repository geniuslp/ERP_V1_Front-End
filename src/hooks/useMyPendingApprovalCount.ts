import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL = (import.meta as any).env?.VITE_API_URL

export interface MyPendingCounts {
  memo: number
  po: number
  wo: number
  pr: number
  total: number
}

const EMPTY: MyPendingCounts = { memo: 0, po: 0, wo: 0, pr: 0, total: 0 }

// GET /approvals/my-pending-counts -> { memo, po, wo, pr, total }. Refetched whenever `refreshKey`
// changes (the layout passes the current path, so approving a document updates the badge).
export function useMyPendingApprovalCount(refreshKey?: string): MyPendingCounts {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [counts, setCounts] = useState<MyPendingCounts>(EMPTY)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    axios
      .get(`${BASE_URL}/approvals/my-pending-counts`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        const d = res.data?.data ?? res.data ?? {}
        if (!cancelled) {
          setCounts({
            memo: Number(d.memo ?? 0), po: Number(d.po ?? 0), wo: Number(d.wo ?? 0), pr: Number(d.pr ?? 0), total: Number(d.total ?? 0),
          })
        }
      })
      .catch(() => { if (!cancelled) setCounts(EMPTY) })
    return () => { cancelled = true }
  }, [accessToken, refreshKey])

  return counts
}
