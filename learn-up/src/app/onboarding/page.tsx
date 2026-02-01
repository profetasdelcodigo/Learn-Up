"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User,
  School,
  GraduationCap,
  Users,
  Loader2,
  CheckCircle,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);

  const [formData, setFormData] = useState({
    full_name: "",
    role: "",
    school: "",
    grade: "",
    section: "",
  });

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // Check if profile already complete
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile?.role && profile?.school && profile?.grade) {
        router.push("/dashboard");
      }
    };

    checkUser();
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!formData.role || !formData.school || !formData.grade) {
      setError("Por favor completa todos los campos obligatorios");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name || null,
          role: formData.role,
          school: formData.school,
          grade: formData.grade,
          section: formData.section || null,
        })
        .eq("id", user?.id);

      if (error) throw error;

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Ocurrió un error al guardar tu perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-brand-black overflow-hidden flex items-center justify-center px-4 py-12">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-blue-glow opacity-10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, 50, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Onboarding card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl p-8 md:p-12 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-brand-gold/10 border border-brand-gold"
            >
              <CheckCircle className="w-8 h-8 text-brand-gold" />
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              ¡Bienvenido a Learn Up!
            </h1>
            <p className="text-gray-400">Completa tu perfil para comenzar</p>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nombre Completo (Opcional)
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  className="w-full pl-12 pr-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors"
                  placeholder="Juan Pérez"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Rol <span className="text-brand-gold">*</span>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: "docente" })}
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    formData.role === "docente"
                      ? "border-brand-gold bg-brand-gold/10 text-white"
                      : "border-gray-700 bg-brand-black text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <GraduationCap className="w-8 h-8 mx-auto mb-2" />
                  <span className="font-medium">Docente</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, role: "estudiante" })
                  }
                  className={`p-4 rounded-2xl border-2 transition-all ${
                    formData.role === "estudiante"
                      ? "border-brand-gold bg-brand-gold/10 text-white"
                      : "border-gray-700 bg-brand-black text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <Users className="w-8 h-8 mx-auto mb-2" />
                  <span className="font-medium">Estudiante</span>
                </button>
              </div>
            </div>

            {/* School */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Colegio <span className="text-brand-gold">*</span>
              </label>
              <div className="relative">
                <School className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) =>
                    setFormData({ ...formData, school: e.target.value })
                  }
                  required
                  className="w-full pl-12 pr-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors"
                  placeholder="Nombre del colegio"
                />
              </div>
            </div>

            {/* Grade & Section */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Grado <span className="text-brand-gold">*</span>
                </label>
                <input
                  type="text"
                  value={formData.grade}
                  onChange={(e) =>
                    setFormData({ ...formData, grade: e.target.value })
                  }
                  required
                  className="w-full px-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors"
                  placeholder="5to, 1ro, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sección (Opcional)
                </label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) =>
                    setFormData({ ...formData, section: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors"
                  placeholder="A, B, C..."
                />
              </div>
            </div>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-brand-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Completar Perfil
                </>
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
