"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User,
  School,
  Users,
  Loader2,
  CheckCircle,
  Sparkles,
  GraduationCap,
} from "lucide-react";
import {
  StaggerContainer,
  FadeUpItem,
} from "@/components/animations/StaggerReveal";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  const [formData, setFormData] = useState({
    username: "",
    full_name: "",
    role: "estudiante",
    school: "",
    grade: "",
    section: "",
  });

  const [usernameError, setUsernameError] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

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
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .limit(1);

      const profile = data?.[0] || null;

      // Prefill data if exists
      if (profile) {
        setFormData((prev) => ({
          ...prev,
          full_name: profile.full_name || user.user_metadata?.full_name || "",
          username: profile.username || user.user_metadata?.username || "",
          role: profile.role || "estudiante",
          school: profile.school || user.user_metadata?.school || "", // Sometimes metadata has it
          grade: profile.grade || "",
          section: profile.section || "",
        }));
      } else {
        // Try to suggest a username from email
        const emailName = user.email?.split("@")[0] || "";
        setFormData((prev) => ({
          ...prev,
          full_name: user.user_metadata?.full_name || "",
          username: emailName,
        }));
      }

      // Determine if they are essentially a new user completing onboarding
      if (!profile || (!profile.username && !profile.role && !profile.school)) {
        setIsNewUser(true);
      }

      if (
        profile?.username &&
        profile?.role &&
        profile?.school &&
        profile?.grade
      ) {
        router.push("/dashboard");
      }
    };

    checkUser();
  }, [router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (
      !formData.username ||
      !formData.school ||
      !formData.grade
    ) {
      setError("Por favor completa todos los campos obligatorios");
      setLoading(false);
      return;
    }

    if (usernameError) {
      setError("Por favor corrige el nombre de usuario");
      setLoading(false);
      return;
    }

    try {
      // Verify user is authenticated
      if (!user?.id) {
        throw new Error("Usuario no autenticado");
      }

      console.log("Guardando perfil para usuario:", user.id);
      console.log("Datos del formulario:", formData);

      // Use upsert to insert or update the profile
      const { data, error } = await supabase.from("profiles").upsert(
        {
          id: user.id, // CRITICAL: Include user ID for upsert
          username: formData.username,
          full_name: formData.full_name || null,
          role: formData.role,
          school: formData.school,
          grade: formData.grade,
          section: formData.section || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id", // Specify that id is the unique constraint
        },
      );

      if (error) {
        console.error("Error de Supabase al guardar perfil:", error);
        throw error;
      }

      console.log("Perfil guardado exitosamente:", data);

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Error completo al guardar perfil:", err);
      setError(err.message || "Ocurrió un error al guardar tu perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Fixed full-screen container — independent of MainLayout overflow */
    <div className="fixed inset-0 bg-brand-black flex flex-col lg:flex-row">
      {/* Left Side - Branding (Visible on Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden border-r border-white/6">
        <div className="absolute inset-0 bg-mesh-1" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/4 -left-1/4 w-[500px] h-[500px] bg-brand-purple/15 rounded-full blur-[120px]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.15, 0.1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-lg"
        >
          <div className="inline-flex items-center justify-center w-24 h-24 mb-8 rounded-3xl border border-brand-gold/20 bg-surface-2/50 backdrop-blur-md shadow-glow-gold">
            <Sparkles className="w-12 h-12 text-brand-gold" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-6 font-display">Paso final</h1>
          <p className="text-lg text-gray-400 leading-relaxed font-body">
            Completa tu perfil para acceder a todas las características, grupos
            y herramientas educativas impulsadas por IA.
          </p>
        </motion.div>
      </div>

      {/* Right Side - Form (scrollable) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center relative bg-brand-black overflow-y-auto">
        <div className="absolute inset-0 overflow-hidden lg:hidden pointer-events-none">
          <motion.div className="absolute top-1/4 right-1/4 w-72 h-72 bg-brand-purple/15 rounded-full blur-[80px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative z-10 w-full max-w-2xl p-6 sm:p-12 my-auto"
        >
          <div className="glass-strong border border-white/8 rounded-2xl p-8 md:p-12 shadow-2xl">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
                className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-brand-gold/8 border border-brand-gold/20 shadow-glow-gold"
              >
                <CheckCircle className="w-8 h-8 text-brand-gold" />
              </motion.div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 font-display">
                ¡Bienvenido a Learn Up!
              </h1>
              <p className="text-gray-500 font-body">Completa tu perfil para comenzar</p>
            </div>

            {/* New User Welcome Banner */}
            {isNewUser && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-6 p-4 bg-brand-gold/5 border border-brand-gold/15 rounded-xl flex items-start gap-3"
              >
                <div className="p-2 bg-brand-gold/10 rounded-lg shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1 text-sm font-display">
                    Estás a un paso de terminar
                  </h3>
                  <p className="text-gray-500 text-xs leading-relaxed font-body">
                    Tu cuenta con{" "}
                    {user?.app_metadata?.provider === "google"
                      ? "Google"
                      : "correo electrónico"}{" "}
                    ha sido creada y verificada. Completa tus datos abajo para
                    configurar tu perfil y acceder a la plataforma.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-500/8 border border-red-500/30 rounded-xl text-red-400 text-sm font-body"
              >
                {error}
              </motion.div>
            )}

            {/* Form */}
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <StaggerContainer delayOffset={0.3}>
                {/* Username Field - NEW */}
                <FadeUpItem>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2 font-body">
                      Nombre de Usuario (@){" "}
                      <span className="text-brand-gold">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                        @
                      </span>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={async (e) => {
                          const val = e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, "");
                          setFormData({ ...formData, username: val });
                          setUsernameError("");

                          if (val.length < 3) return;

                          setIsCheckingUsername(true);
                          const { data } = await supabase.rpc(
                            "check_username_availability",
                            { username_check: val },
                          );
                          // Also check if it's OUR username (if editing existing profile)
                          const isSelf = user?.user_metadata?.username === val;

                          if (!data && !isSelf) {
                            // data is true if available? RPC returns boolean.
                            // RPC: RETURN NOT EXISTS ...
                            // So if it returns true, it IS available.
                            // BUT wait, if user already has this username, check_username_availability will return FALSE.
                            // We need to handle re-saving own username.
                            // Ideally, we check if the found profile ID is ours.
                            // Simple fix: If RPC says unavailable, verify if it belongs to current user?
                            // RPC implementation: SELECT 1 FROM profiles WHERE username = username_check
                            // I should probably stick to simple check. If unavailable, error.
                            // BUT if I am reloading the page, I load my own username.
                            // So I should only check validation if it Changed? Or rely on upsert?
                            // Let's assume on mount satisfied "profile complete" check.
                            // If we are here, we are saving.
                            // I'll trust the RPC for new inputs.
                            // If prefilled, user might not change it.
                            // Let's rely on RPC.
                          }
                          if (!data) {
                            // Unavailable
                            // Double check if it's ours?
                            // Client side check:
                            // We can't easily check owner without another query.
                            // Assume if unavailable, it's taken.
                            // Exception: If we just loaded our own profile.
                            if (user?.user_metadata?.username !== val) {
                              setUsernameError(
                                "Nombre de usuario no disponible",
                              );
                            }
                          }
                          setIsCheckingUsername(false);
                        }}
                        className={`input-base pl-10 !rounded-xl ${usernameError ? "!border-red-500" : ""}`}
                        placeholder="usuario_unico"
                      />
                      {isCheckingUsername && (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-500" />
                      )}
                    </div>
                    {usernameError && (
                      <p className="text-red-500 text-xs mt-1 ml-4">
                        {usernameError}
                      </p>
                    )}
                  </div>
                </FadeUpItem>

                {/* Full Name */}
                <FadeUpItem>
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
                          setFormData({
                            ...formData,
                            full_name: e.target.value,
                          })
                        }
                        className="input-base pl-12 !rounded-xl"
                        placeholder="Juan Pérez"
                      />
                    </div>
                  </div>
                </FadeUpItem>

                {/* Role */}
                <FadeUpItem>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-4">
                      Rol <span className="text-brand-gold">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: "estudiante" })}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                          formData.role === "estudiante"
                            ? "border-brand-gold bg-brand-gold/10 text-white shadow-glow-gold/20"
                            : "border-white/10 bg-white/5 text-gray-500 hover:border-white/20"
                        }`}
                      >
                        <Users className={`w-8 h-8 ${formData.role === "estudiante" ? "text-brand-gold" : "text-gray-500"}`} />
                        <span className="font-medium text-sm">Estudiante</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: "docente" })}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                          formData.role === "docente"
                            ? "border-blue-500 bg-blue-500/10 text-white shadow-blue-500/20"
                            : "border-white/10 bg-white/5 text-gray-500 hover:border-white/20"
                        }`}
                      >
                        <GraduationCap className={`w-8 h-8 ${formData.role === "docente" ? "text-blue-400" : "text-gray-500"}`} />
                        <span className="font-medium text-sm">Docente</span>
                      </button>
                    </div>
                  </div>
                </FadeUpItem>

                {/* School */}
                <FadeUpItem>
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
                        className="input-base pl-12 !rounded-xl"
                        placeholder="Nombre del colegio"
                      />
                    </div>
                  </div>
                </FadeUpItem>

                {/* Grade & Section */}
                <FadeUpItem className="grid md:grid-cols-2 gap-4">
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
                      className="input-base !rounded-xl"
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
                      className="input-base !rounded-xl"
                      placeholder="A, B, C..."
                    />
                  </div>
                </FadeUpItem>

                {/* Submit button */}
                <FadeUpItem>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn-primary w-full !rounded-xl mt-8"
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
                </FadeUpItem>
              </StaggerContainer>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
