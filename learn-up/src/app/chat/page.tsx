"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageCircle, User2Icon } from "lucide-react";

interface Message {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    school: string | null;
    grade: string | null;
  };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial messages and set up realtime subscription
  useEffect(() => {
    const loadMessages = async () => {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      // Load initial messages
      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          `
          id,
          content,
          user_id,
          created_at,
          profiles:user_id (
            full_name,
            avatar_url,
            role,
            school,
            grade
          )
        `,
        )
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) {
        console.error("Error loading messages:", error);
      } else if (data) {
        setMessages(data as any);
      }

      setInitialLoading(false);
    };

    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel("room1") // Uses room1 as requested
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          // Fetch the full message with profile data
          const { data } = await supabase
            .from("chat_messages")
            .select(
              `
              id,
              content,
              user_id,
              created_at,
              profiles:user_id (
                full_name,
                avatar_url,
                role,
                school,
                grade
              )
            `,
            )
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data as any];
            });
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Chat connected!");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const messageContent = input.trim();
    setInput("");
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("chat_messages").insert({
        content: messageContent,
        user_id: user.id,
      });

      if (error) throw error;
    } catch (err) {
      console.error("Error sending message:", err);
      // Re-add the message to input on error
      setInput(messageContent);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-brand-gold/10 border border-brand-gold shadow-[0_0_15px_rgba(0,255,255,0.3)]">
            <MessageCircle className="w-8 h-8 text-brand-gold" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Aprendamos Juntos
          </h1>
          <p className="text-gray-400">
            Charla en tiempo real con tu comunidad educativa
          </p>
        </div>

        {/* Chat Container */}
        <div className="bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl overflow-hidden shadow-[0_0_20px_rgba(0,255,255,0.15)]">
          {/* Messages */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No hay mensajes aún. ¡Sé el primero en escribir!</p>
              </div>
            )}

            <AnimatePresence>
              {messages.map((message) => {
                const isOwnMessage = message.user_id === currentUserId;
                const userName = message.profiles?.full_name || "Usuario";
                const avatarUrl = message.profiles?.avatar_url;
                const role = message.profiles?.role || "";
                const school = message.profiles?.school || "";

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={userName}
                          className="w-10 h-10 rounded-full border border-brand-gold shadow-[0_0_5px_rgba(0,255,255,0.4)]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-brand-gold/10 border border-brand-gold flex items-center justify-center shadow-[0_0_5px_rgba(0,255,255,0.4)]">
                          <User2Icon className="w-5 h-5 text-brand-gold" />
                        </div>
                      )}
                    </div>

                    {/* Message Content */}
                    <div
                      className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"} max-w-[80%]`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-xs font-bold text-brand-gold">
                          {userName}
                        </span>
                        {role && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-800 text-cyan-400 border border-cyan-900">
                            {role}
                          </span>
                        )}
                        {school && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[100px]">
                            {school}
                          </span>
                        )}
                      </div>

                      <div
                        className={`p-4 rounded-2xl relative shadow-lg ${
                          isOwnMessage
                            ? "bg-brand-gold/20 border border-brand-gold text-white"
                            : "bg-gray-900/50 border border-gray-700 text-gray-200"
                        }`}
                      >
                        {/* Glow effect for own messages */}
                        {isOwnMessage && (
                          <div className="absolute inset-0 rounded-2xl bg-brand-gold/5 blur-md -z-10"></div>
                        )}

                        <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">
                          {message.content}
                        </p>
                      </div>

                      <div className="text-[10px] text-gray-600 mt-1 px-1">
                        {new Date(message.created_at).toLocaleTimeString(
                          "es-ES",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

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
                placeholder="Escribe un mensaje..."
                disabled={loading}
                className="flex-1 px-4 py-3 bg-brand-black border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-brand-gold text-brand-black font-semibold rounded-full hover:bg-brand-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
