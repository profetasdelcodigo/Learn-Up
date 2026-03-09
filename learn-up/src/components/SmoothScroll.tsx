// SmoothScroll.tsx — Renders children with no scroll interception.
// Lenis was causing scroll conflicts with the MainLayout overflow-y-auto container.
// We now rely on CSS `scroll-behavior: smooth` and native browser smooth scrolling,
// which is perfectly smooth on modern browsers and doesn't break layout overflow.

export default function SmoothScroll({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
