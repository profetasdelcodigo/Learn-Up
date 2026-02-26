import {
  X,
  User2Icon,
  MapPin,
  BookOpen,
  GraduationCap,
  Link2,
} from "lucide-react";

interface UserInfoPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    username?: string;
    full_name: string;
    avatar_url: string | null;
    school?: string;
    grade?: string;
    role?: string;
    location?: string;
  };
}

export default function UserInfoPanel({
  isOpen,
  onClose,
  user,
}: UserInfoPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-brand-black border-l border-brand-gold/30 z-40 shadow-2xl overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="sticky top-0 bg-brand-black/95 backdrop-blur-xl border-b border-gray-800 p-4 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Info del Contacto</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* User Photo */}
      <div className="p-8 flex flex-col items-center border-b border-gray-800 relative">
        <div className="w-32 h-32 rounded-full bg-brand-gold/20 border-4 border-brand-gold/50 flex items-center justify-center mb-6 overflow-hidden shadow-[0_0_30px_rgba(255,215,0,0.15)]">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              className="w-full h-full object-cover"
              alt={user.full_name}
            />
          ) : (
            <User2Icon className="w-16 h-16 text-brand-gold" />
          )}
        </div>

        <div className="w-full flex flex-col items-center gap-1">
          <h3 className="text-2xl font-bold text-white tracking-tight text-center">
            {user.full_name || user.username}
          </h3>
          {user.username && (
            <p className="text-brand-gold/80 font-medium">@{user.username}</p>
          )}

          {user.role === "profesor" && (
            <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-brand-gold/20 text-brand-gold text-xs font-bold uppercase tracking-wider">
              Profesor
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-6 space-y-4">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
          Sobre {user.full_name?.split(" ")[0] || "el usuario"}
        </h4>

        <div className="space-y-3">
          {user.school && (
            <div className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
              <div className="bg-gray-800 p-2 rounded-lg text-brand-gold shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">
                  Escuela / Institución
                </p>
                <p className="text-sm text-white font-medium">{user.school}</p>
              </div>
            </div>
          )}

          {user.grade && (
            <div className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
              <div className="bg-gray-800 p-2 rounded-lg text-brand-gold shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">
                  Grado / Nivel
                </p>
                <p className="text-sm text-white font-medium">{user.grade}</p>
              </div>
            </div>
          )}

          {user.location && (
            <div className="flex items-start gap-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
              <div className="bg-gray-800 p-2 rounded-lg text-brand-gold shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1">
                  Ubicación
                </p>
                <p className="text-sm text-white font-medium">
                  {user.location}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
