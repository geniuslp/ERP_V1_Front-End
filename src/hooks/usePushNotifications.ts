import { useCallback, useEffect, useState } from 'react'
import api from '@/services/api'

// Web Push on this device. The service worker (public/sw.js) shows the message; the API sends it only while the
// user has no ERP page open (see erp-api internal/notify). One subscription per browser/device.

export type PushState =
  | 'unsupported' // browser cannot do Web Push
  | 'needs-install' // iPhone/iPad: must be opened from the Home Screen icon first
  | 'denied' // the user blocked notifications in the browser
  | 'off'
  | 'on'

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  if (existing) return existing
  await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
  return navigator.serviceWorker.ready
}

function detect(): PushState {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  return 'off'
}

export function usePushNotifications(enabled: boolean) {
  const [state, setState] = useState<PushState>(() => detect())
  const [busy, setBusy] = useState(false)
  // false when the API has no VAPID keys configured
  const [serverEnabled, setServerEnabled] = useState(true)

  // Work out whether this browser is already subscribed (and silently re-save it for the signed-in user).
  useEffect(() => {
    if (!enabled) return
    const base = detect()
    if (base !== 'off') {
      setState(base)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
        const sub = await reg?.pushManager.getSubscription()
        if (cancelled) return
        if (sub && Notification.permission === 'granted') {
          // Same browser can be used by another account: always re-save so the endpoint belongs to this user.
          await api.post('/notifications/push/subscribe', sub.toJSON()).catch(() => undefined)
          setState('on')
        } else {
          setState('off')
        }
      } catch {
        /* leave as 'off' */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  const enable = useCallback(async (): Promise<string | null> => {
    setBusy(true)
    try {
      const { data: k } = await api.get('/notifications/push/public-key')
      if (!k?.enabled) {
        setServerEnabled(false)
        return 'ระบบยังไม่เปิดใช้การแจ้งเตือนบนมือถือ'
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return 'ไม่ได้รับอนุญาตให้แจ้งเตือน'
      }
      const reg = await getRegistration()
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(k.public_key) as unknown as BufferSource,
        })
      }
      await api.post('/notifications/push/subscribe', sub.toJSON())
      setState('on')
      return null
    } catch (e: any) {
      return e?.response?.data?.message || 'เปิดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async (): Promise<string | null> => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await api.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => undefined)
        await sub.unsubscribe()
      }
      setState('off')
      return null
    } catch {
      return 'ปิดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, busy, serverEnabled, enable, disable }
}
