"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";

/**
 * OfflineDetector — shows a non-intrusive banner when the user loses connectivity.
 * Automatically dismisses 3s after connection is restored.
 * Safe area aware (respects device notch/status bar).
 */
export default function OfflineDetector() {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [wasOffline]);

  return (
    <AnimatePresence>
      {/* Offline banner */}
      {!isOnline && (
        <motion.div
          key="offline"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-3 px-4 bg-red-600 text-white text-sm font-semibold shadow-lg"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          Sin conexión — revisando tu red...
        </motion.div>
      )}

      {/* Reconnected toast */}
      {isOnline && showReconnected && (
        <motion.div
          key="online"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
          className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 text-white text-sm font-semibold shadow-lg"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <Wifi className="w-4 h-4 shrink-0" />
          ¡Conexión restaurada!
        </motion.div>
      )}
    </AnimatePresence>
  );
}
