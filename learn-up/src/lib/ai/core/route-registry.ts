export interface AppRoute {
  id: string;
  label: string;
  path: string;
}

// Canonical routes verified against the current Next.js app tree/sidebar.
export const APP_ROUTES: AppRoute[] = [
  { id: "dashboard", label: "Inicio", path: "/dashboard" },
  { id: "aprendamos-juntos", label: "Aprendamos Juntos", path: "/chat" },
  { id: "calendar", label: "Calendario", path: "/calendar" },
  { id: "library", label: "Biblioteca", path: "/library" },
  { id: "album", label: "Álbum", path: "/album" },
  { id: "profesor", label: "Profesor IA", path: "/ai/profesor" },
  { id: "examen", label: "Examen IA", path: "/ai/practica" },
  { id: "consejero", label: "Consejero IA", path: "/ai/consejero" },
  { id: "recetas", label: "Recetas IA", path: "/ai/recetas" },
];

const ROUTE_BY_ID = new Map(APP_ROUTES.map((route) => [route.id, route]));
const NORMALIZED = APP_ROUTES.map((route) => ({
  ...route,
  normalized: route.label.toLocaleLowerCase("es-PE"),
}));

export function getAppRoute(idOrLabel: string): AppRoute | null {
  const key = String(idOrLabel || "").trim().toLowerCase();
  if (!key) return null;

  const direct = ROUTE_BY_ID.get(key);
  if (direct) return direct;

  const exact = NORMALIZED.find((route) => route.normalized === key);
  if (exact) return exact;

  const contains = NORMALIZED.find(
    (route) => route.normalized.includes(key) || key.includes(route.normalized),
  );
  return contains || null;
}

export function isValidInternalRoute(path: string): boolean {
  const candidate = String(path || "").split("?")[0].split("#")[0];
  return APP_ROUTES.some((route) => route.path === candidate);
}

export function getRouteCatalog(): string {
  return APP_ROUTES.map((route) => `- ${route.label}: ${route.path}`).join("\n");
}
