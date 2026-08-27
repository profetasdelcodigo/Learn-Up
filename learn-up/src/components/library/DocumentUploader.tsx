"use client";

import { useState } from "react";
import { uploadAndIndexAiDocument } from "@/actions/library";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, X, FileText, Loader2, Brain } from "lucide-react";

interface DocumentUploaderProps {
  onClose: () => void;
  onSuccess: () => void;
  sessionId?: string;
}

export default function DocumentUploader({
  onClose,
  onSuccess,
  sessionId,
}: DocumentUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);

      const result = await uploadAndIndexAiDocument(formData, sessionId);

      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || "Error al procesar el documento");
      }
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado");
    } finally {
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+1rem)]"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-brand-black border border-brand-blue-glow rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Brain className="w-6 h-6 text-brand-blue-glow" />
              Indexar para IA
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gray-400 hover:border-brand-blue-glow hover:text-brand-blue-glow transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-4 p-4 bg-brand-blue-glow/10 border border-brand-blue-glow/30 rounded-2xl text-sm text-gray-300">
            Sube un documento para que la Inteligencia Artificial pueda leerlo, analizarlo y responder preguntas sobre él.
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Título del Documento *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-blue-glow"
                placeholder="Ej: Apuntes de Historia Moderna"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Archivo *
              </label>

              {file && (
                <div className="mb-4">
                  <div className="w-full h-24 bg-surface-2 rounded-xl flex items-center justify-center border border-white/10 text-gray-400">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-brand-blue-glow" />
                      <span className="text-sm font-semibold truncate max-w-xs">
                        {file.name}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-2xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-blue-glow file:text-brand-black hover:file:bg-white focus:outline-none focus:border-brand-blue-glow"
                accept=".pdf,.txt,.md"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                Formatos soportados: PDF, TXT, MD. (Max 10MB)
              </p>
            </div>

            <button
              type="submit"
              disabled={uploading || !file || !title}
              className="w-full py-3 bg-brand-blue-glow text-brand-black font-bold rounded-full hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Procesando e indexando...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" /> Subir e Indexar
                </>
              )}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
