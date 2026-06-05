import type { ReactNode } from "react";
import {
  X,
  User2Icon,
  MapPin,
  BookOpen,
  GraduationCap,
  Link2,
  Instagram,
  Linkedin,
  School,
} from "lucide-react";

interface UserInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    username?: string | null;
    full_name?: string | null;
    avatar_url: string | null;
    school?: string | null;
    grade?: string | null;
    section?: string | null;
    role?: string | null;
    description?: string | null;
    country?: string | null;
    location?: string | null;
    socials?: Record<string, string | null> | null;
    linkedin?: string | null;
    tiktok?: string | null;
    instagram?: string | null;
  };
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.75a8.19 8.19 0 0 0 4.78 1.52V6.78a4.85 4.85 0 0 1-1.01-.09z" />
  </svg>
);

function displayValue(value?: string | null) {
  return value?.trim() || "Pendiente";
}

function roleLabel(role?: string | null) {
  if (role === "docente" || role === "profesor") return "Docente";
  if (role === "admin") return "Admin";
  return "Estudiante";
}

function socialValue(
  user: UserInfoPanelProps["user"],
  key: "linkedin" | "tiktok" | "instagram",
) {
  return user.socials?.[key] || user[key] || "";
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: string | null;
}) {
  const resolved = displayValue(value);
  const isPending = resolved === "Pendiente";

  return (
    <div className="flex items-start gap-4 rounded-xl border border-white/8 bg-surface-2/50 p-4">
      <div className="shrink-0 rounded-lg bg-surface-2 p-2 text-brand-gold">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium text-gray-400">{label}</p>
        <p
          className={`break-words text-sm font-medium ${
            isPending ? "text-gray-500" : "text-white"
          }`}
        >
          {resolved}
        </p>
      </div>
    </div>
  );
}

export default function UserInfoPanel({
  isOpen,
  onClose,
  user,
}: UserInfoPanelProps) {
  if (!isOpen) return null;

  const displayName = user.full_name || user.username || "Usuario";
  const firstName = user.full_name?.split(" ")[0] || user.username || "usuario";
  const linkedin = socialValue(user, "linkedin");
  const tiktok = socialValue(user, "tiktok");
  const instagram = socialValue(user, "instagram");

  return (
    <div className="fixed md:static inset-y-0 right-0 z-40 md:z-10 w-full overflow-y-auto border-l border-brand-gold/30 bg-surface-2/40 backdrop-blur-xl shadow-2xl md:shadow-none md:w-80 lg:w-96 flex-shrink-0 transition-all duration-300">
      <div className="sticky top-0 z-10 border-b border-white/6 bg-brand-black/95 p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Info del Contacto</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-white/10"
            aria-label="Cerrar informacion del contacto"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-col items-center border-b border-white/6 p-8">
        <div className="mb-6 flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-brand-gold/50 bg-brand-gold/20 shadow-[0_0_30px_rgba(255,215,0,0.15)]">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              className="h-full w-full object-cover"
              alt={displayName}
            />
          ) : (
            <User2Icon className="h-16 w-16 text-brand-gold" />
          )}
        </div>

        <div className="flex w-full flex-col items-center gap-1">
          <h3 className="text-center text-2xl font-bold tracking-tight text-white">
            {displayName}
          </h3>
          <p className="font-medium text-brand-gold/80">
            @{user.username || "usuario"}
          </p>
          <span className="mt-2 inline-flex items-center rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-gold">
            {roleLabel(user.role)}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500">
          Perfil de {firstName}
        </h4>

        <div className="space-y-3">
          <DetailCard
            icon={<User2Icon className="h-5 w-5" />}
            label="Biografia"
            value={user.description}
          />
          <DetailCard
            icon={<School className="h-5 w-5" />}
            label="Institucion"
            value={user.school}
          />
          <DetailCard
            icon={<GraduationCap className="h-5 w-5" />}
            label="Grado"
            value={user.grade}
          />
          <DetailCard
            icon={<BookOpen className="h-5 w-5" />}
            label="Seccion"
            value={user.section}
          />
          <DetailCard
            icon={<MapPin className="h-5 w-5" />}
            label="Ubicacion"
            value={user.country || user.location}
          />
          <DetailCard
            icon={<Link2 className="h-5 w-5" />}
            label="Rol"
            value={roleLabel(user.role)}
          />
        </div>

        <div className="pt-2">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">
            Redes sociales
          </h4>
          <div className="space-y-2">
            <DetailCard
              icon={<Linkedin className="h-5 w-5 text-blue-400" />}
              label="LinkedIn"
              value={linkedin ? `@${linkedin}` : null}
            />
            <DetailCard
              icon={<TikTokIcon className="h-5 w-5 text-gray-300" />}
              label="TikTok"
              value={tiktok ? `@${tiktok}` : null}
            />
            <DetailCard
              icon={<Instagram className="h-5 w-5 text-pink-400" />}
              label="Instagram"
              value={instagram ? `@${instagram}` : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
