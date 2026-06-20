"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Trash2, 
  Moon, 
  Sun, 
  Monitor, 
  AlertTriangle, 
  Settings,
  Shield,
  Loader2
} from "lucide-react";
import { deleteAccountAction } from "@/actions/user";
import { createClient } from "@/utils/supabase/client";
import { appSignOut } from "@/lib/auth-logout";

export default function SettingsPage() {
  const supabase = createClient();
  const [theme, setTheme] = useState("dark");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    // Ideally we would fetch theme from localStorage or next-themes
    const storedTheme = localStorage.getItem("theme") || "dark";
    setTheme(storedTheme);

    // Fetch user
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserEmail(data.user.email || "");
    };
    getUser();
  }, [supabase]);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    // Real implementation requires next-themes or global class toggling
    if (newTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteAccountAction();
      if (result.success) {
        await appSignOut({
          scope: "local",
          redirectReason: "cuenta_eliminada",
          clearPwaState: true,
        });
      } else {
        alert("Hubo un error al eliminar tu cuenta: " + result.error);
        setIsDeleting(false);
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un error al eliminar tu cuenta.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
          <Settings className="w-8 h-8 text-brand-gold" />
          Ajustes
        </h1>
        <p className="text-gray-400 mt-2 font-body">
          Administra tus preferencias, privacidad y la seguridad de tu cuenta.
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance Settings */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass border border-white/10 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-brand-purple/10 rounded-xl">
              <Monitor className="w-6 h-6 text-brand-purple" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-display">Apariencia</h2>
              <p className="text-sm text-gray-400 font-body">Personaliza cómo se ve Learn Up.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => handleThemeChange("dark")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                theme === "dark" 
                  ? "border-brand-purple bg-brand-purple/10 text-white shadow-glow-purple/20" 
                  : "border-white/10 text-gray-400 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <Moon className={`w-6 h-6 ${theme === "dark" ? "text-brand-purple" : "text-gray-500"}`} />
              <span className="font-medium">Modo Oscuro</span>
            </button>

            <button
              onClick={() => handleThemeChange("light")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                theme === "light" 
                  ? "border-brand-gold bg-brand-gold/10 text-white shadow-glow-gold/20" 
                  : "border-white/10 text-gray-400 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <Sun className={`w-6 h-6 ${theme === "light" ? "text-brand-gold" : "text-gray-500"}`} />
              <span className="font-medium">Modo Claro</span>
            </button>
            
            <button
              onClick={() => handleThemeChange("system")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                theme === "system" 
                  ? "border-blue-500 bg-blue-500/10 text-white shadow-blue-500/20" 
                  : "border-white/10 text-gray-400 hover:border-white/20 hover:bg-white/5"
              }`}
            >
              <Monitor className={`w-6 h-6 ${theme === "system" ? "text-blue-400" : "text-gray-500"}`} />
              <span className="font-medium">Sistema</span>
            </button>
          </div>
        </motion.div>

        {/* Privacy & Security */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass border border-white/10 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-500/10 rounded-xl">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-display">Privacidad y Seguridad</h2>
              <p className="text-sm text-gray-400 font-body">Administra tu información y accesos.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <h3 className="font-semibold text-white">Correo electrónico</h3>
                <p className="text-sm text-gray-400">{userEmail}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
              <div>
                <h3 className="font-semibold text-white">Términos y Privacidad</h3>
                <p className="text-sm text-gray-400">Revisa los acuerdos legales de la plataforma.</p>
              </div>
              <button className="text-sm text-brand-gold hover:underline">Ver políticas</button>
            </div>
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-500 font-display">Zona de Peligro</h2>
              <p className="text-sm text-red-400/80 font-body">Acciones irreversibles para tu cuenta.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-red-500/5 rounded-xl border border-red-500/20">
            <div>
              <h3 className="font-semibold text-white">Eliminar Cuenta Permanentemente</h3>
              <p className="text-sm text-red-300">
                Se borrarán todos tus datos, conversaciones, archivos de la biblioteca y progreso. 
                Esta acción no se puede deshacer.
              </p>
            </div>
            
            {!showConfirmDelete ? (
              <button 
                onClick={() => setShowConfirmDelete(true)}
                className="shrink-0 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl transition-colors flex items-center gap-2 font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar Cuenta
              </button>
            ) : (
              <div className="flex flex-col gap-2 shrink-0">
                <p className="text-xs text-red-400 font-bold text-right">¿Estás absolutamente seguro?</p>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowConfirmDelete(false)}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Sí, eliminar todo
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
