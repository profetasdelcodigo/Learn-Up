import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Brain,
  Heart,
  ChefHat,
  Calendar,
  MessageCircle,
  Camera,
  GraduationCap,
  User,
  Bell,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div className="w-full min-h-screen bg-brand-black">
      <div className="w-full">
        <div className="w-full max-w-none space-y-8">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-black via-brand-gold/5 to-brand-black border border-brand-gold/30 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="text-brand-gold/70 text-sm font-medium uppercase tracking-widest mb-1">
                  {greeting()},
                </p>
                <h1 className="text-4xl md:text-5xl font-black text-white mb-2 truncate max-w-full">
                  {profile?.full_name || "Estudiante"}
                </h1>
                <p className="text-gray-400 text-sm">
                  {profile?.school && `${profile.school} · `}
                  {profile?.grade || ""}
                </p>
              </div>
              <div className="flex gap-3">
                <Link
                  href="/dashboard/notifications"
                  className="p-3 bg-gray-900 border border-gray-700 rounded-2xl text-gray-400 hover:text-brand-gold hover:border-brand-gold transition-all"
                >
                  <Bell className="w-5 h-5" />
                </Link>
                <Link
                  href="/dashboard/profile"
                  className="flex items-center gap-3 px-4 py-3 bg-gray-900 border border-gray-700 rounded-2xl text-gray-300 hover:text-brand-gold hover:border-brand-gold transition-all"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      className="w-7 h-7 rounded-full object-cover"
                      alt="Avatar"
                    />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium hidden md:block">
                    Mi Perfil
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* AI Section */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-5 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-sm">
                🧠
              </span>
              Potencia tu Mente
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Link href="/ai/profesor">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-brand-gold/30 rounded-2xl p-6 hover:border-brand-gold hover:bg-brand-gold/5 transition-all cursor-pointer group">
                  <div className="w-12 h-12 mb-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center group-hover:scale-110 group-hover:border-brand-gold transition-all">
                    <BookOpen className="w-6 h-6 text-brand-gold" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Profesor IA
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Tu tutor que te enseña a pensar profundamente
                  </p>
                </div>
              </Link>

              <Link href="/ai/practica">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-brand-blue-glow/30 rounded-2xl p-6 hover:border-brand-blue-glow hover:bg-brand-blue-glow/5 transition-all cursor-pointer group">
                  <div className="w-12 h-12 mb-4 rounded-2xl bg-brand-blue-glow/10 border border-brand-blue-glow/30 flex items-center justify-center group-hover:scale-110 group-hover:border-brand-blue-glow transition-all">
                    <GraduationCap className="w-6 h-6 text-brand-blue-glow" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Examen IA
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Exámenes reales con preguntas abiertas y cerradas
                  </p>
                </div>
              </Link>

              <Link href="/ai/consejero">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-pink-500/30 rounded-2xl p-6 hover:border-pink-500 hover:bg-pink-500/5 transition-all cursor-pointer group">
                  <div className="w-12 h-12 mb-4 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center group-hover:scale-110 group-hover:border-pink-500 transition-all">
                    <Heart className="w-6 h-6 text-pink-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Consejero IA
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Apoyo emocional e inteligencia para tu bienestar
                  </p>
                </div>
              </Link>
            </div>
          </section>

          {/* Productivity Section */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-5 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center text-sm">
                📚
              </span>
              Mi Espacio
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <Link href="/calendar">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-brand-gold/30 rounded-2xl p-6 hover:border-brand-gold hover:bg-brand-gold/5 transition-all cursor-pointer group">
                  <div className="w-12 h-12 mb-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center group-hover:scale-110 group-hover:border-brand-gold transition-all">
                    <Calendar className="w-6 h-6 text-brand-gold" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Hora de Actuar
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Calendarios, habit tracker y planes compartidos
                  </p>
                </div>
              </Link>

              <Link href="/chat">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-500 hover:bg-cyan-500/5 transition-all cursor-pointer group">
                  <div className="w-12 h-12 mb-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 group-hover:border-cyan-500 transition-all">
                    <MessageCircle className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Aprendamos Juntos
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Chat en tiempo real con videollamadas
                  </p>
                </div>
              </Link>

              <Link href="/library">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-brand-gold/30 rounded-2xl p-6 hover:border-brand-gold hover:bg-brand-gold/5 transition-all cursor-pointer group">
                  <div className="w-12 h-12 mb-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center group-hover:scale-110 group-hover:border-brand-gold transition-all">
                    <BookOpen className="w-6 h-6 text-brand-gold" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Biblioteca del Sabio
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Material educativo revisado por docentes
                  </p>
                </div>
              </Link>

              <Link href="/ai/recetas">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-6 hover:border-orange-500 hover:bg-orange-500/5 transition-all cursor-pointer group">
                  <div className="w-12 h-12 mb-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center group-hover:scale-110 group-hover:border-orange-500 transition-all">
                    <ChefHat className="w-6 h-6 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Nutrirecetas
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Recetas saludables y deliciosas con IA
                  </p>
                </div>
              </Link>

              <Link href="/album">
                <div className="bg-gray-900/80 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-6 hover:border-emerald-500 hover:bg-emerald-500/5 transition-all cursor-pointer group">
                  <div className="w-12 h-12 mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 group-hover:border-emerald-500 transition-all">
                    <Camera className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    Álbum del Saber
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Tu cámara y galería de recuerdos educativos
                  </p>
                </div>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
