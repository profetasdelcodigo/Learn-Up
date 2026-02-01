"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  MessageCircle,
  User2Icon,
  Video,
  Edit3,
  Search,
  MoreVertical,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

const CONTACTS = [
  {
    id: "room1",
    name: "General",
    type: "group",
    avatar: null,
    lastMsg: "¡Hola a todos!",
  },
  {
    id: "math",
    name: "Matemáticas",
    type: "group",
    avatar: null,
    lastMsg: "¿Alguien entiende integrales?",
  },
  {
    id: "science",
    name: "Ciencias",
    type: "group",
    avatar: null,
    lastMsg: "Feria de ciencias el viernes",
  },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState("room1");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

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

      // Load initial messages for active channel
      // Note: In a real app we would filter by channel_id
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
      .channel(activeChat)
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
          console.log(`Connected to ${activeChat}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, activeChat]);

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
        // In a real app we'd add channel_id: activeChat here
      });

      if (error) throw error;
    } catch (err) {
      console.error("Error sending message:", err);
      setInput(messageContent);
    } finally {
      setLoading(false);
    }
  };

  const startStudySession = () => {
    router.push("/study");
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black p-4 md:p-6 overflow-hidden">
      <div className="max-w-[1600px] mx-auto h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] flex gap-4">
        {/* LEFT COLUMN: Contacts/Groups */}
        <div className="hidden md:flex flex-col w-80 bg-brand-black/80 backdrop-blur-xl border border-brand-gold/30 rounded-3xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-800 bg-black/40">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Chats</h2>
              <div className="flex gap-2">
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Edit3 className="w-5 h-5 text-brand-gold" />
                </button>
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <MoreVertical className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-gold/50"
              />
            </div>
          </div>

          {/* Contacts List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {CONTACTS.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setActiveChat(contact.id)}
                className={`flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-gray-800/50 hover:bg-gray-800/30 ${activeChat === contact.id ? "bg-brand-gold/10 border-l-4 border-l-brand-gold" : ""}`}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-brand-gold/20 flex items-center justify-center border border-brand-gold/30">
                    <Users className="w-6 h-6 text-brand-gold" />
                  </div>
                  {/* Online indicator */}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white truncate">
                      {contact.name}
                    </h3>
                    <span className="text-xs text-brand-gold">12:30</span>
                  </div>
                  <p className="text-sm text-gray-400 truncate">
                    {contact.lastMsg}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat */}
        <div className="flex-1 flex flex-col bg-brand-black/80 backdrop-blur-xl border border-brand-gold rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(0,255,255,0.05)] relative">
          {/* Chat Header */}
          <div className="h-16 flex items-center justify-between px-6 bg-black/40 border-b border-brand-gold/30 z-10">
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                {/* Back button for mobile would go here */}
              </div>
              <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center border border-brand-gold/30">
                <Users className="w-5 h-5 text-brand-gold" />
              </div>
              <div>
                <h2 className="font-bold text-white text-lg">
                  {CONTACTS.find((c) => c.id === activeChat)?.name || "Chat"}
                </h2>
                <p className="text-xs text-brand-gold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  En línea
                </p>
              </div>
            </div>

            {/* Header Actions: Video & Whiteboard */}
            <div className="flex items-center gap-3">
              <button
                onClick={startStudySession}
                className="group"
                title="Videollamada con Jitsi"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 border border-gray-700 hover:border-brand-gold/50 hover:bg-gray-800 transition-all shadow-[0_0_10px_rgba(0,255,255,0.1)] group-hover:shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                  <Video className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-gray-300 hidden lg:inline">
                    Llamada
                  </span>
                </div>
              </button>

              <button
                onClick={startStudySession}
                className="group"
                title="Pizarra Compartida Tldraw"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-900 border border-gray-700 hover:border-brand-gold/50 hover:bg-gray-800 transition-all shadow-[0_0_10px_rgba(0,255,255,0.1)] group-hover:shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                  <Edit3 className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-gray-300 hidden lg:inline">
                    Pizarra
                  </span>
                </div>
              </button>

              <div className="w-px h-6 bg-gray-800 mx-1"></div>

              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Search className="w-5 h-5 text-gray-400" />
              </button>
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 relative bg-gradient-to-b from-transparent to-brand-black/50">
            {/* Background Pattern */}
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 2px 2px, rgba(212,175,55,0.15) 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            ></div>

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-70">
                <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center mb-4">
                  <MessageCircle className="w-8 h-8 text-gray-600" />
                </div>
                <p>
                  No hay mensajes aún en{" "}
                  {CONTACTS.find((c) => c.id === activeChat)?.name}.
                </p>
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
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : "flex-row"} items-end group`}
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 mb-1">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt={userName}
                          className="w-8 h-8 rounded-full border border-brand-gold/50 shadow-[0_0_5px_rgba(0,255,255,0.2)]"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-gold/10 border border-brand-gold/50 flex items-center justify-center shadow-[0_0_5px_rgba(0,255,255,0.2)]">
                          <User2Icon className="w-4 h-4 text-brand-gold" />
                        </div>
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"} max-w-[75%] md:max-w-[60%]`}
                    >
                      {!isOwnMessage && (
                        <div className="flex items-baseline gap-2 mb-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-bold text-brand-gold">
                            {userName}
                          </span>
                          {role && (
                            <span className="text-[10px] text-cyan-400 bg-cyan-900/30 px-1 rounded">
                              {role}
                            </span>
                          )}
                        </div>
                      )}

                      <div
                        className={`px-4 py-2.5 rounded-2xl relative shadow-sm ${
                          isOwnMessage
                            ? "bg-brand-gold text-brand-black rounded-br-none"
                            : "bg-gray-900 text-gray-200 border border-gray-800 rounded-bl-none"
                        }`}
                      >
                        {/* School tag inside message only if not own and first msg in sequence? Simplified: Always show school if relevant */}
                        {!isOwnMessage && school && (
                          <div className="text-[10px] text-gray-500 mb-1 font-mono">
                            {school}
                          </div>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        <div
                          className={`text-[10px] mt-1 text-right ${isOwnMessage ? "text-brand-black/60" : "text-gray-500"}`}
                        >
                          {new Date(message.created_at).toLocaleTimeString(
                            "es-ES",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-black/40 border-t border-brand-gold/20">
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-brand-gold transition-colors"
              >
                <PlusIcon className="w-6 h-6" />
              </button>

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  disabled={loading}
                  className="w-full pl-5 pr-12 py-3 bg-gray-900/80 border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/50 transition-all font-light"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-1.5 top-1.5 p-1.5 bg-brand-gold rounded-full text-brand-black hover:bg-white transition-colors disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-500"
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
        </div>
      </div>
    </div>
  );
}

// Simple Plus icon helper since it wasn't imported
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14M12 5v14" />
    </svg>
  );
}
