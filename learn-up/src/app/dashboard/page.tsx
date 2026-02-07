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
} from "lucide-react";
import Tutorial from "@/components/Tutorial";

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

  return (
    <>
      <Tutorial />
      <div className="min-h-screen bg-brand-black">
        <div className="p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl p-8 mb-8 mt-16 md:mt-0 relative flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  Dashboard
                </h1>
                <p className="text-gray-400">
                  Bienvenido, {profile?.full_name || user.email}
                </p>
              </div>
            </div>

            {/* AI Tools Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4 px-2">
                🧠 Potencia tu mente
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Professor AI */}
                <Link href="/ai/profesor">
                  <div className="bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl p-6 hover:bg-brand-gold/5 transition-all cursor-pointer group">
                    <div className="w-12 h-12 mb-4 rounded-full bg-brand-gold/10 border border-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BookOpen className="w-6 h-6 text-brand-gold" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Profesor IA
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Tu tutor socrático que te enseña a pensar
                    </p>
                  </div>
                </Link>

                {/* Practice Mode */}
                <Link href="/ai/practica">
                  <div className="bg-brand-black/80 backdrop-blur-xl border border-purple-500 rounded-3xl p-6 hover:bg-purple-500/5 transition-all cursor-pointer group">
                    <div className="w-12 h-12 mb-4 rounded-full bg-purple-500/10 border border-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Brain className="w-6 h-6 text-purple-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Modo Práctica
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Genera quizzes personalizados para estudiar
                    </p>
                  </div>
                </Link>

                {/* Counselor AI */}
                <Link href="/ai/consejero">
                  <div className="bg-brand-black/80 backdrop-blur-xl border border-pink-500 rounded-3xl p-6 hover:bg-pink-500/5 transition-all cursor-pointer group">
                    <div className="w-12 h-12 mb-4 rounded-full bg-pink-500/10 border border-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Heart className="w-6 h-6 text-pink-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Consejero IA
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Apoyo emocional cuando lo necesites
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Productivity Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4 px-2">
                📚 Productividad
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <Link href="/calendar">
                  <div className="bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl p-6 hover:bg-brand-gold/5 transition-all cursor-pointer group">
                    <div className="w-12 h-12 mb-4 rounded-full bg-brand-gold/10 border border-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Calendar className="w-6 h-6 text-brand-gold" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Hora de Actuar
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Agenda tus tareas y eventos
                    </p>
                  </div>
                </Link>

                {/* Chat */}
                <Link href="/chat">
                  <div className="bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl p-6 hover:bg-brand-gold/5 transition-all cursor-pointer group">
                    <div className="w-12 h-12 mb-4 rounded-full bg-brand-gold/10 border border-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-6 h-6 text-brand-gold" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Aprendamos Juntos
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Chat en tiempo real con tu comunidad
                    </p>
                  </div>
                </Link>

                {/* Library */}
                <Link href="/library">
                  <div className="bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl p-6 hover:bg-brand-gold/5 transition-all cursor-pointer group">
                    <div className="w-12 h-12 mb-4 rounded-full bg-brand-gold/10 border border-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BookOpen className="w-6 h-6 text-brand-gold" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Mundo Lector
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Recursos educativos compartidos
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Recipes Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-4 px-2">
                🍳 Nutrirecetas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Recipe Generator */}
                <Link href="/ai/recetas">
                  <div className="bg-brand-black/80 backdrop-blur-xl border border-orange-500 rounded-3xl p-6 hover:bg-orange-500/5 transition-all cursor-pointer group">
                    <div className="w-12 h-12 mb-4 rounded-full bg-orange-500/10 border border-orange-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ChefHat className="w-6 h-6 text-orange-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Generar Receta
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Recetas saludables y deliciosas al instante
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Profile */}
            <div className="bg-brand-black/80 backdrop-blur-xl border border-gray-700 rounded-3xl p-8">
              <h3 className="text-lg font-semibold text-brand-gold mb-3">
                Tu Perfil
              </h3>
              <div className="space-y-1 text-sm text-gray-300">
                <p>
                  <span className="text-gray-500">Rol:</span> {profile?.role}
                </p>
                <p>
                  <span className="text-gray-500">Colegio:</span>{" "}
                  {profile?.school}
                </p>
                <p>
                  <span className="text-gray-500">Grado:</span> {profile?.grade}
                </p>
                {profile?.section && (
                  <p>
                    <span className="text-gray-500">Sección:</span>{" "}
                    {profile.section}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
