import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useAppSelector } from '@/store'

const BASE_URL: string = (import.meta as any).env?.VITE_API_URL ?? ''

export type NotificationType = 'APPROVAL_REQUEST' | 'APPROVED' | 'REJECTED' | 'FINANCE_PAYABLE'

export interface AppNotification {
  id: number
  type: NotificationType
  title: string
  message: string
  doc_type: string | null
  doc_id: number | null
  doc_no: string | null
  link: string | null
  is_read: boolean
  created_at: string
  read_at: string | null
  // approval request whose document is still waiting for me: keeps counting on the bell even once read
  pending: boolean
}

// http(s)://host/api/v1 -> ws(s)://host/api/v1 ; a relative base (/api/v1) uses the page's own host.
function wsBase(): string {
  if (/^https?:\/\//i.test(BASE_URL)) return BASE_URL.replace(/^http/i, 'ws')
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${BASE_URL}`
}

const MAX_ITEMS = 50

/**
 * The bell's data: GET /notifications once, then new rows arrive live over WS /ws/notifications (token in the query
 * string). The socket reconnects with a growing delay; a reconnect re-fetches the list so nothing sent while it was
 * down is missed. `onPush` fires for each row received live (used for the toast). The list is re-fetched whenever
 * `refreshKey` changes (the layout passes the current path), which is how a "waiting for approval" item clears
 * after the user approves / rejects the document.
 *
 * `attention` = rows still needing the user: unread ones, plus approval requests that are still pending even if read.
 */
export function useNotifications(onPush?: (n: AppNotification) => void, refreshKey?: string) {
  const accessToken = useAppSelector((s) => s.auth.tokens?.accessToken)
  const [items, setItems] = useState<AppNotification[]>([])
  const [lastPushId, setLastPushId] = useState(0)
  const onPushRef = useRef(onPush)
  onPushRef.current = onPush

  const attention = useMemo(() => items.filter((i) => !i.is_read || i.pending).length, [items])
  const unread = useMemo(() => items.filter((i) => !i.is_read).length, [items])

  const reload = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await axios.get(`${BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { limit: MAX_ITEMS },
      })
      setItems(Array.isArray(res.data?.data) ? res.data.data : [])
    } catch {
      /* keep the previous list; the next reconnect retries */
    }
  }, [accessToken])

  // Re-fetch on navigation so a decided document stops being "pending".
  useEffect(() => {
    reload()
  }, [reload, refreshKey])

  useEffect(() => {
    if (!accessToken) {
      setItems([])
      return
    }
    let closed = false
    let ws: WebSocket | null = null
    let retry = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      if (closed) return
      ws = new WebSocket(`${wsBase()}/ws/notifications?token=${encodeURIComponent(accessToken)}`)
      ws.onopen = () => {
        retry = 0
        reload() // catch up on anything missed while disconnected
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg?.event === 'remove') {
            // The document was decided: its "waiting for your approval" row is gone.
            setItems((prev) => prev.filter((p) => p.id !== Number(msg.id)))
            return
          }
          if (msg?.event !== 'notification' || !msg.data) return
          const n = msg.data as AppNotification
          setItems((prev) => {
            // A newer request for the same document supersedes the older pending one.
            const rest = prev
              .filter((p) => p.id !== n.id)
              .map((p) => (n.type === 'APPROVAL_REQUEST' && p.type === 'APPROVAL_REQUEST' && p.doc_type === n.doc_type && p.doc_id === n.doc_id ? { ...p, pending: false } : p))
            return [n, ...rest].slice(0, MAX_ITEMS)
          })
          setLastPushId(n.id)
          onPushRef.current?.(n)
        } catch {
          /* ignore malformed frames */
        }
      }
      ws.onclose = () => {
        if (closed) return
        retry += 1
        timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(retry, 5)))
      }
      ws.onerror = () => ws?.close()
    }

    connect()
    return () => {
      closed = true
      if (timer) clearTimeout(timer)
      ws?.close()
    }
  }, [accessToken, reload])

  const markRead = useCallback(
    async (id: number) => {
      const target = items.find((i) => i.id === id)
      if (!target || target.is_read) return
      // A result notification is removed once read; an approval request stays (marked read) until the document is decided.
      setItems((prev) =>
        target.type === 'APPROVAL_REQUEST' ? prev.map((i) => (i.id === id ? { ...i, is_read: true } : i)) : prev.filter((i) => i.id !== id),
      )
      try {
        await axios.put(`${BASE_URL}/notifications/${id}/read`, null, { headers: { Authorization: `Bearer ${accessToken}` } })
      } catch {
        reload()
      }
    },
    [items, reload, accessToken],
  )

  // "Read all" clears the result notifications; approval requests stay (read) until their document is decided.
  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.filter((i) => i.type === 'APPROVAL_REQUEST').map((i) => ({ ...i, is_read: true })))
    try {
      await axios.put(`${BASE_URL}/notifications/read-all`, null, { headers: { Authorization: `Bearer ${accessToken}` } })
    } catch {
      reload()
    }
  }, [reload, accessToken])

  return { items, attention, unread, lastPushId, markRead, markAllRead }
}
