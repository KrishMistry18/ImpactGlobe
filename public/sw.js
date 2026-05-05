// Service Worker for Push Notifications
// ImpactGlobe

self.addEventListener('push', function (event) {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: data.icon || '/globe.svg',
    badge: data.badge || '/globe.svg',
    data: {
      url: data.url,
      eventId: data.eventId,
    },
    vibrate: [200, 100, 200],
    tag: data.eventId || 'impactglobe-notification',
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus()
        }
      }

      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url)
      }
    })
  )
})

self.addEventListener('install', function (event) {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim())
})
