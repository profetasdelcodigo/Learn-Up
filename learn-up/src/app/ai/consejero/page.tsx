"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Send, Loader2 } from "lucide-react";
import { askCounselor } from "@/actions/ai-tutor";
import BackButton from "@/components/BackButton";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function CounselorChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setError("");

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const result = await askCounselor(userMessage);

      if (result.error) {
        setError(result.error);
      } else if (result.response) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.response },
        ]);
      }
    } catch (err) {
      setError("Ocurrió un error inesperado. Por favor intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <BackButton className="mb-6" />
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-pink-500/10 border border-pink-500">
            <Heart className="w-8 h-8 text-pink-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Consejero IA</h1>
          <p className="text-gray-400">
            Un espacio seguro para hablar sobre tus emociones y preocupaciones.
          </p>
        </div>

        {/* Chat Container */}
        <div className="bg-brand-black/80 backdrop-blur-xl border border-pink-500 rounded-3xl overflow-hidden">
          {/* Messages */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500 text-center px-4">
                <p>
                  Comparte lo que tengas en mente. Estoy aquí para escucharte.
                </p>
              </div>
            )}

            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl ${
                      message.role === "user"
                        ? "bg-pink-500 text-white"
                        : "bg-brand-black border border-pink-500 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-brand-black border border-pink-500 rounded-2xl p-4">
                  <Loader2 className="w-5 h-5 text-pink-500 animate-spin" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 pb-4">
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-6 border-t border-gray-800"
          >
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Cuéntame qué te preocupa..."
                disabled={loading}
                className="flex-1 px-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-pink-500 text-white font-semibold rounded-full hover:bg-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </form>
        </div>

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
