self.addEventListener('push', function(event) {
  const options = {
    body: 'Não se esqueça de colocar os gastos de hoje 💰',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'daily-reminder',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification('ZaGastos', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
