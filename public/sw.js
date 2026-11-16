/* Service worker: Web Push only (no offline caching).
 * Served from the app base path (/erp/sw.js, /erp/uat/sw.js), so self.registration.scope is that base. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'ERP', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'ERP'
  event.waitUntil(
    (async () => {
      // This device is looking at the app right now: the in-page toast already shows it, so skip the banner.
      // (Other devices of the same user still get theirs.) Any doubt -> show it.
      try {
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        if (wins.some((c) => c.url.startsWith(self.registration.scope) && c.visibilityState === 'visible')) return
      } catch (e) {
        /* show the banner */
      }
      await self.registration.showNotification(title, {
        body: data.body || '',
        icon: 'brand/icon-192.png',
        badge: 'brand/favicon-64.png',
        tag: data.tag || undefined, // a newer notification of the same document replaces the older one
        renotify: !!data.tag,
        data: { link: data.link || '' },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || ''
  // link is app-relative ("/pr/12?for_approval=true"); the app lives under the scope ("/erp/")
  const target = new URL(link.replace(/^\//, ''), self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && 'navigate' in c) {
          try {
            await c.navigate(target)
            return c.focus()
          } catch (e) {
            /* fall through to openWindow */
          }
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
