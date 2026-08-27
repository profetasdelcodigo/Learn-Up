// Desactiva logs de workbox en dev
self.__WB_DISABLE_DEV_LOGS = true;

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = JSON.parse(event.data?.text() || "{}");
  } catch (err) {
    console.error("Error parsing push payload", err);
  }

  const title = data.title || "Learn Up";
  const options = {
    body: data.message || data.body || "Tienes una nueva notificación",
    icon: "/icon-192.png", // Assuming valid standard icon
    badge: "/icon-192.png",
    data: data.link || data.url || "/chat",
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    tag: data.tag || "default-tag",
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data || "/chat";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Find if the target URL is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // If not open, focus the first window or open a new one
        if (clientList.length > 0) {
          return clientList[0].focus().then((client) => {
             if ("navigate" in client) return client.navigate(urlToOpen);
          });
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});

self.addEventListener("notificationclose", (event) => {
  // Manejo de notification close, util para analytics o descartes
  console.log("Notification closed:", event.notification.tag);
});
