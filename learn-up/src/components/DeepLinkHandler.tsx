"use client";

import { useEffect } from "react";
import { App, URLOpenListenerEvent } from "@capacitor/app";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

/**
 * DeepLinkHandler
 *
 * Componente que escucha eventos appUrlOpen de Capacitor.
 * Permite que la aplicación regrese al WebView cuando se abre un esquema personalizado
 * como com.learnup.app://...
 */
export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    // Solo registrar en plataformas nativas (Android/iOS)
    if (!Capacitor.isNativePlatform()) return;

    const setupListener = async () => {
      const listener = await App.addListener(
        "appUrlOpen",
        (event: URLOpenListenerEvent) => {
          console.log("Deep link interceptado:", event.url);

          try {
            const url = new URL(event.url);

            // El host suele ser la primera parte despues de :// (ej: auth en com.learnup.app://auth/callback)
            // El pathname es el resto.
            const path = url.host + url.pathname;
            const search = url.search;

            // Reconstruir la ruta para el router de Next.js
            const relativePath = `/${path}${search}`;

            console.log("Navegando internamente a:", relativePath);

            if (relativePath.startsWith("/auth/callback")) {
              // Forzar recarga de página para que el Route Handler de Next.js procese el código
              window.location.href = relativePath;
            } else {
              router.push(relativePath);
            }
          } catch (error) {
            console.error("Error procesando deep link:", error);
          }
        },
      );

      return listener;
    };

    let listenerHandle: any;
    setupListener().then((h) => (listenerHandle = h));

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [router]);

  // Este componente no renderiza nada, solo gestiona efectos
  return null;
}
