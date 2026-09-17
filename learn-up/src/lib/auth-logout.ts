"use client";

export type AppSignOutScope = "local" | "others" | "global" | "selected";

type SignOutOptions = {
  scope: AppSignOutScope;
  sessionIds?: string[];
  redirect?: boolean;
  redirectReason?: string;
  clearPwaState?: boolean;
};

function isAuthStorageKey(key: string) {
  const normalized = key.toLowerCase();
  return normalized.startsWith("sb-") || normalized.includes("supabase.auth") || normalized.includes("learn-up-auth") || normalized.includes("learnup-auth");
}
export function clearAuthStorage() {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && isAuthStorageKey(key)) storage.removeItem(key);
    }
  }
}

export async function clearLearnUpPwaState() {
  if (typeof window === "undefined") return;
  if ("caches" in window) {
    const keys = await window.caches.keys().catch(() => []);
    await Promise.all(keys.filter((key) => /learn.?up|next-pwa|workbox|start-url|precache|runtime/i.test(key)).map((key) => window.caches.delete(key).catch(() => false)));
  }
  // Keep the service worker registered: it is what allows an already-subscribed
  // device to receive push notifications while Learn Up is closed.
}

async function detachPushForCurrentAccount() {
  if (typeof window === "undefined") return;
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ action: "unsubscribe", endpoint: subscription?.endpoint ?? null }),
    }).catch(() => undefined);
    if (subscription) await subscription.unsubscribe().catch(() => false);
  } catch {
    // Logout must continue even when the browser push API is unavailable.
  }
}

export async function appSignOut({ scope, sessionIds = [], redirect = true, redirectReason = "sesion_cerrada", clearPwaState = false }: SignOutOptions) {
  const body = scope === "selected" ? { scope, session_ids: sessionIds } : { scope };

  // Detach this browser's push endpoint before invalidating the authenticated session.
  if (scope === "local" || scope === "global") await detachPushForCurrentAccount();

  const res = await fetch("/api/auth/signout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok && res.status !== 401) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "No se pudo cerrar la sesión.");
  }
  if (scope === "local" || scope === "global") clearAuthStorage();
  if (clearPwaState || scope === "local" || scope === "global") await clearLearnUpPwaState();
  if (redirect && (scope === "local" || scope === "global")) window.location.replace(`/login?reason=${encodeURIComponent(redirectReason)}`);
  return res.json().catch(() => ({ ok: res.ok, scope }));
}
