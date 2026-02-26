"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  Loader2,
  User,
  School,
  GraduationCap,
  Save,
  Camera,
  Instagram,
  Linkedin,
} from "lucide-react";
import BackButton from "@/components/BackButton";

// TikTok SVG icon (not in lucide-react)
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

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const [formData, setFormData] = useState({
    description: "",
    country: "",
    linkedin: "",
    tiktok: "",
    instagram: "",
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
        const socials = data.socials || {};
        setFormData({
          description: data.description || "",
          country: data.country || "",
          linkedin: socials.linkedin || data.linkedin || "",
          tiktok: socials.tiktok || data.tiktok || "",
          instagram: socials.instagram || data.instagram || "",
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
        linkedin: formData.linkedin,
        tiktok: formData.tiktok,
        instagram: formData.instagram,
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          description: formData.description,
          country: formData.country,
          socials,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
      // Show success toast instead of alert
      setProfile({
        ...profile,
        description: formData.description,
        country: formData.country,
        socials,
      });
    } catch (e) {
      console.error("Profile save error:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setSaving(true);
    const file = e.target.files[0];
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id);

      setProfile({ ...profile, avatar_url: publicUrl });
    } catch (error) {
      console.error("Error uploading avatar:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-black">
        <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black text-white p-4 md:p-8 pt-6">
      <div className="max-w-4xl mx-auto">
        <BackButton className="mb-6" />

        <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
          <User className="w-8 h-8 text-brand-gold" />
          Mi Perfil
        </h1>

        <div className="grid md:grid-cols-3 gap-8">
          {/* LEFT: Avatar & Academic */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-brand-gold/20 to-transparent" />

              <div className="relative inline-block mb-4 mt-8">
                <div className="w-28 h-28 rounded-full bg-brand-black border-2 border-brand-gold flex items-center justify-center overflow-hidden">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      className="w-full h-full object-cover"
                      alt="Avatar"
                    />
                  ) : (
                    <User className="w-12 h-12 text-gray-500" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-brand-gold rounded-full text-brand-black cursor-pointer hover:bg-white transition-colors shadow-lg">
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
              <p className="text-brand-gold text-sm mb-2">
                @{profile?.username || "usuario"}
              </p>

              <div className="flex gap-2 justify-center">
                {profile?.role === "docente" ? (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs border border-blue-500/30 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Docente
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-brand-gold/20 text-brand-gold rounded-full text-xs border border-brand-gold/30 flex items-center gap-1">
                    <User className="w-3 h-3" /> Estudiante
                  </span>
                )}
              </div>

              {/* Socials Display */}
              {(formData.linkedin || formData.tiktok || formData.instagram) && (
                <div className="flex justify-center gap-3 mt-4 pt-4 border-t border-gray-800">
                  {formData.linkedin && (
                    <a
                      href={`https://linkedin.com/in/${formData.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Linkedin className="w-5 h-5" />
                    </a>
                  )}
                  {formData.tiktok && (
                    <a
                      href={`https://tiktok.com/@${formData.tiktok}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-white transition-colors"
                    >
                      <TikTokIcon className="w-5 h-5" />
                    </a>
                  )}
                  {formData.instagram && (
                    <a
                      href={`https://instagram.com/${formData.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-400 hover:text-pink-300 transition-colors"
                    >
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Academic Info */}
            <div className="bg-gray-900 rounded-3xl p-6 border border-gray-800 space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <School className="w-5 h-5 text-gray-400" /> Académico
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-gray-500 mb-1 text-xs uppercase tracking-wide">
                    Institución
                  </label>
                  <p className="text-white bg-black/30 p-2 rounded-lg">
                    {profile?.school || "—"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-500 mb-1 text-xs uppercase tracking-wide">
                      Grado
                    </label>
                    <p className="text-white bg-black/30 p-2 rounded-lg">
                      {profile?.grade || "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1 text-xs uppercase tracking-wide">
                      Sección
                    </label>
                    <p className="text-white bg-black/30 p-2 rounded-lg">
                      {profile?.section || "—"}
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
                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none h-24 resize-none transition-colors"
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
                    className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none transition-colors"
                    placeholder="País / Ciudad"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm rounded-3xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold mb-6">Redes Sociales</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Linkedin className="w-5 h-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.linkedin}
                    onChange={(e) =>
                      setFormData({ ...formData, linkedin: e.target.value })
                    }
                    className="flex-1 bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none transition-colors"
                    placeholder="Tu usuario de LinkedIn"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-700/30 flex items-center justify-center flex-shrink-0">
                    <TikTokIcon className="w-5 h-5 text-gray-300" />
                  </div>
                  <input
                    type="text"
                    value={formData.tiktok}
                    onChange={(e) =>
                      setFormData({ ...formData, tiktok: e.target.value })
                    }
                    className="flex-1 bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none transition-colors"
                    placeholder="Tu usuario de TikTok"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-5 h-5 text-pink-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.instagram}
                    onChange={(e) =>
                      setFormData({ ...formData, instagram: e.target.value })
                    }
                    className="flex-1 bg-black/40 border border-gray-700 rounded-xl p-3 text-white focus:border-brand-gold outline-none transition-colors"
                    placeholder="Tu usuario de Instagram"
                  />
                </div>
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
                className="px-6 py-3 rounded-full bg-brand-gold text-brand-black font-bold hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-60"
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
