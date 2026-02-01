"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { uploadLibraryFile } from "@/actions/library";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Upload,
  X,
  Loader2,
  FileText,
  ExternalLink,
} from "lucide-react";

interface LibraryItem {
  id: string;
  title: string;
  file_url: string;
  is_approved: boolean;
  created_at: string;
  profiles?: {
    full_name: string | null;
  };
}

export default function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    file: null as File | null,
  });

  const supabase = createClient();

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from("library_items")
        .select(
          `
          id,
          title,
          file_url,
          is_approved,
          created_at,
          profiles:user_id (
            full_name
          )
        `,
        )
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setItems((data as any) || []);
    } catch (err) {
      console.error("Error loading library items:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file || !formData.title) return;

    setUploading(true);

    try {
      const data = new FormData();
      data.append("file", formData.file);
      data.append("title", formData.title);

      const result = await uploadLibraryFile(data);

      if (result.success) {
        setShowModal(false);
        setFormData({ title: "", file: null });
        alert(
          "¡Aporte enviado! Será revisado por un docente antes de publicarse.",
        );
      } else {
        alert(result.error || "Error al subir el archivo");
      }
    } catch (err) {
      console.error("Error uploading:", err);
      alert("Error inesperado al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-brand-gold/10 border border-brand-gold flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-brand-gold" />
                </div>
                <h1 className="text-4xl font-bold text-white">Mundo Lector</h1>
              </div>
              <p className="text-gray-400 ml-15">
                Comparte y descubre recursos educativos de la comunidad
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-3 bg-brand-gold text-brand-black font-semibold rounded-full hover:bg-brand-gold/90 transition-all flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Subir Aporte
            </button>
          </div>
        </div>

        {/* Library Grid */}
        {items.length === 0 ? (
          <div className="bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              No hay recursos disponibles aún
            </h3>
            <p className="text-gray-500">
              ¡Sé el primero en compartir un recurso educativo!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl p-6 hover:bg-brand-gold/5 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-brand-gold/10 border border-brand-gold flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6 text-brand-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white mb-2 truncate">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-400 mb-4">
                      {item.profiles?.full_name || "Anónimo"} •{" "}
                      {new Date(item.created_at).toLocaleDateString("es-ES")}
                    </p>
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-black text-sm font-medium rounded-full hover:bg-brand-gold/90 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ver Archivo
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Upload Modal */}
        <AnimatePresence>
          {showModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-brand-black border border-brand-gold rounded-3xl p-8 max-w-md w-full"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    Subir Aporte
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 hover:border-brand-gold hover:text-brand-gold transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-4 p-4 bg-brand-gold/10 border border-brand-gold/50 rounded-2xl">
                  <p className="text-sm text-gray-300">
                    ℹ️ Tu aporte será revisado por un docente antes de
                    publicarse
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Título del Recurso *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-brand-black border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors"
                      placeholder="Ej: Resumen de Historia del Perú"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Archivo *
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleFileChange}
                        className="w-full px-4 py-3 bg-brand-black border border-gray-700 rounded-2xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-gold file:text-brand-black hover:file:bg-brand-gold/90 focus:outline-none focus:border-brand-gold transition-colors"
                        accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Formatos: PDF, DOC, DOCX, TXT, PPT, PPTX
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading || !formData.file || !formData.title}
                    className="w-full py-3 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-brand-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Subir Aporte
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Back to Dashboard */}
        <div className="mt-6 text-center">
          <a
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            ← Volver al Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
