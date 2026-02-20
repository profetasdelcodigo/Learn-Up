declare let self: ServiceWorkerGlobalScope;

// Desactiva logs de workbox en dev
self.__WB_DISABLE_DEV_LOGS = true;

self.addEventListener("push", (event) => {
  const data = JSON.parse(event?.data?.text() || "{}");
  event?.waitUntil(
    self.registration.showNotification(data.title || "Learn Up", {
      body: data.message || "Tienes una nueva notificación",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: data.link || "/chat",
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      tag: "call",
      requireInteraction: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event?.notification.close();
  event?.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          let client = clientList[0];
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
              client = clientList[i];
            }
          }
          return client.focus();
        }
        return self.clients.openWindow(event.notification.data);
      }),
  );
});
