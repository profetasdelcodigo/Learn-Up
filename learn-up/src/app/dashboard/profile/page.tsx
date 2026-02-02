"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  Loader2,
  User,
  Mail,
  School,
  GraduationCap,
  Save,
  Camera,
  Globe,
  Twitter,
  Linkedin,
  Github,
} from "lucide-react";
import { motion } from "framer-motion";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [language, setLanguage] = useState("es");

  const [formData, setFormData] = useState({
    description: "",
    country: "",
    website: "",
    twitter: "",
    linkedin: "",
  });

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(data);
      if (data) {
        setFormData({
          description: data.description || "",
          country: data.country || "",
          website: data.socials?.website || "",
          twitter: data.socials?.twitter || "",
          linkedin: data.socials?.linkedin || "",
        });
      }
      setLoading(false);
    };

    loadProfile();
  }, [supabase, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const socials = {
        website: formData.website,
        twitter: formData.twitter,
        linkedin: formData.linkedin,
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          description: formData.description,
          country: formData.country,
          socials: socials,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
      alert("Perfil actualizado correctamente");
    } catch (e) {
      console.error(e);
      alert("Error al actualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    alert(
      "La subida de archivos requiere configuración de Storage. Por ahora, esta función es demostrativa.",
    );
    // Real implementation would be:
    // const file = e.target.files[0];
    // const fileExt = file.name.split('.').pop();
    // const fileName = `${user.id}-${Math.random()}.${fileExt}`;
    // const { error } = await supabase.storage.from('avatars').upload(fileName, file);
    // ... get public URL ... update profile ...
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-black">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black text-white p-4 md:p-8 pt-20">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <User className="w-8 h-8 text-brand-gold" />
          Mi Perfil
        </h1>

        <div className="grid md:grid-cols-3 gap-8">
          {/* LEFT: Stats & Avatar */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-brand-gold/20 to-transparent"></div>

              <div className="relative inline-block mb-4 mt-8">
                <div className="w-24 h-24 rounded-full bg-brand-black border-2 border-brand-gold flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-gray-500" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-brand-gold rounded-full text-brand-black cursor-pointer hover:bg-white transition-colors">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                  />
                </label>
              </div>

              <h2 className="text-xl font-bold">
                {profile?.full_name || "Usuario"}
              </h2>
              <p className="text-brand-gold text-sm">
                @{profile?.username || "usuario"}
              </p>

              <div className="flex gap-2 justify-center mt-4">
                {profile?.role === "docente" ? (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs border border-blue-500/30 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Docente
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs border border-green-500/30 flex items-center gap-1">
                    <User className="w-3 h-3" /> Estudiante
                  </span>
                )}
              </div>
            </div>

            {/* Academic Info Read-Only */}
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <School className="w-5 h-5 text-gray-400" /> Académico
              </h3>
              <div className="space-y-4 text-sm">
                <div>
                  <label className="block text-gray-500 mb-1">
                    Institución
                  </label>
                  <p className="text-white bg-black/30 p-2 rounded-lg">
                    {profile?.school}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1">Grado</label>
                    <p className="text-white bg-black/30 p-2 rounded-lg">
                      {profile?.grade}
                    </p>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">Sección</label>
                    <p className="text-white bg-black/30 p-2 rounded-lg">
                      {profile?.section || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Edit Form */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-3xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold mb-6">
                Información Personal
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Biografía
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none h-24 resize-none"
                    placeholder="Cuéntanos un poco sobre ti..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Ubicación
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none"
                    placeholder="País / Ciudad"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm rounded-3xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold mb-6">Redes y Contacto</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) =>
                      setFormData({ ...formData, website: e.target.value })
                    }
                    className="flex-1 bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none"
                    placeholder="Sitio Web"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Twitter className="w-5 h-5 text-blue-400" />
                  <input
                    type="text"
                    value={formData.twitter}
                    onChange={(e) =>
                      setFormData({ ...formData, twitter: e.target.value })
                    }
                    className="flex-1 bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none"
                    placeholder="Usuario de Twitter"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Linkedin className="w-5 h-5 text-blue-600" />
                  <input
                    type="text"
                    value={formData.linkedin}
                    onChange={(e) =>
                      setFormData({ ...formData, linkedin: e.target.value })
                    }
                    className="flex-1 bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none"
                    placeholder="LinkedIn URL"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm rounded-3xl p-6 border border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">Idioma de la plataforma</h3>
                <p className="text-sm text-gray-500">
                  Selecciona tu idioma preferido
                </p>
              </div>
              <div className="flex bg-black/40 rounded-lg p-1 border border-gray-700">
                <button
                  onClick={() => setLanguage("es")}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${language === "es" ? "bg-brand-gold text-black font-medium" : "text-gray-400 hover:text-white"}`}
                >
                  Español
                </button>
                <button
                  onClick={() => setLanguage("en")}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${language === "en" ? "bg-brand-gold text-black font-medium" : "text-gray-400 hover:text-white"}`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => router.back()}
                className="px-6 py-3 rounded-full border border-gray-700 text-gray-300 hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 rounded-full bg-brand-gold text-brand-black font-bold hover:bg-white transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
