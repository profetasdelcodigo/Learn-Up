"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  ArrowLeft,
  UserPlus,
  Check,
  X,
  Bell,
} from "lucide-react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { createDailyRoom } from "@/actions/daily-video";
import {
  searchUsers,
  sendFriendRequest,
  getFriends,
  getPendingRequests,
  acceptFriendRequest,
} from "@/actions/friendship";
import { getUserRooms, ensurePrivateRoom } from "@/actions/chat";
import dynamic from "next/dynamic";

const DailyVideo = dynamic(() => import("@/components/DailyVideo"), {
  ssr: false,
  loading: () => null,
});

const Whiteboard = dynamic(() => import("@/components/Whiteboard"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-gray-400">
      Cargando Pizarra...
    </div>
  ),
});

interface Message {
  id: string;
  content: string;
  user_id: string;
  room_id: string;
  created_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    school: string | null;
    grade: string | null;
  };
}

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  friendshipStatus?: string; // for search
  friendshipId?: string; // for actions
}

interface ChatRoom {
  id: string;
  type: "private" | "group";
  name?: string;
  participants: string[];
  last_message?: string;
  updated_at: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Data State
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Navigation State
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<"chats" | "search" | "requests">(
    "chats",
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  // Load Initial Data
  useEffect(() => {
    const initData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUserId(user.id);

      // Parallel fetch
      const [friendsData, roomsData, requestsData] = await Promise.all([
        getFriends(),
        getUserRooms(),
        getPendingRequests(),
      ]);

      setFriends(friendsData);
      setRooms(roomsData);
      setPendingRequests(requestsData);
      setInitialLoading(false);
    };

    initData();
  }, [router, supabase]);

  // Search Logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setIsSearching(true);
        setViewMode("search");
        try {
          const results = await searchUsers(searchQuery);
          setSearchResults(results as UserProfile[]);
        } catch (e) {
          console.error(e);
        } finally {
          setIsSearching(false);
        }
      } else if (searchQuery.length === 0) {
        setViewMode("chats");
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Messages Subscription & Loading
  useEffect(() => {
    if (!activeChat) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          `
          id, content, user_id, room_id, created_at,
          profiles:user_id (full_name, avatar_url, role, school, grade)
        `,
        )
        .eq("room_id", activeChat)
        .order("created_at", { ascending: true })
        .limit(50);

      if (!error && data) setMessages(data as any);
    };

    loadMessages();

    // Subscribe to NEW messages in this room
    const channel = supabase
      .channel(`room:${activeChat}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${activeChat}`,
        },
        async (payload) => {
          // Fetch full profile for new message
          const { data } = await supabase
            .from("chat_messages")
            .select(
              `
              id, content, user_id, room_id, created_at,
              profiles:user_id (full_name, avatar_url, role, school, grade)
            `,
            )
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data as any];
            });
            scrollToBottom();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat, supabase]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Actions
  const handleStartCall = async () => {
    if (!activeChat) return;
    try {
      // Use Hashed ID for clean URL
      const { url } = await createDailyRoom({
        name: `room-${activeChat}`.replace(/[^a-zA-Z0-9-]/g, ""),
      });
      setVideoUrl(url);
      setShowVideo(true);
    } catch (e) {
      console.error(e);
      alert("Error al iniciar llamada. Verifica tu configuración.");
    }
  };

  const startChatWithFriend = async (friendId: string) => {
    try {
      setInitialLoading(true);
      const roomId = await ensurePrivateRoom(friendId);

      // Refresh rooms list
      const updatedRooms = await getUserRooms();
      setRooms(updatedRooms);

      setActiveChat(roomId);
      setMobileShowChat(true);
      setSearchQuery(""); // Clear search
      setViewMode("chats");
    } catch (e) {
      console.error(e);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !activeChat || !currentUserId) return;

    const content = input.trim();
    setInput("");
    setLoading(true);

    try {
      const { error } = await supabase.from("chat_messages").insert({
        content,
        user_id: currentUserId,
        room_id: activeChat,
      });
      if (error) throw error;

      // Optimistically update last message in room list (optional)
    } catch (e) {
      console.error(e);
      setInput(content);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (targetId: string) => {
    try {
      await sendFriendRequest(targetId);
      // Update UI state to show pending?
      // Re-trigger search to update status
      const results = await searchUsers(searchQuery);
      setSearchResults(results as UserProfile[]);
    } catch (e) {
      alert("Error enviando solicitud");
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      // Refresh data
      const [f, p] = await Promise.all([getFriends(), getPendingRequests()]);
      setFriends(f);
      setPendingRequests(p);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to get room display info
  const getRoomInfo = (room: ChatRoom) => {
    if (room.type === "group") {
      return { name: room.name, avatar: null, status: "Grupo" };
    }
    // Private: Find other user
    const otherId = room.participants.find((p) => p !== currentUserId);
    const friend = friends.find((f) => f.id === otherId);
    return {
      name: friend?.full_name || friend?.username || "Usuario",
      avatar: friend?.avatar_url,
      status: "En línea", // Mock status
    };
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black pb-16 md:pb-6 md:p-6 overflow-hidden">
      <BottomNav />
      <div className="max-w-[1600px] mx-auto h-[calc(100vh-4rem)] md:h-[calc(100vh-3rem)] flex gap-4 md:mt-0 relative">
        {/* SIDEBAR */}
        <div
          className={`
            flex-col w-full md:w-96 bg-brand-black/95 md:bg-brand-black/80 backdrop-blur-xl border-r md:border border-brand-gold/30 rounded-none md:rounded-3xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] z-20 
            ${mobileShowChat ? "hidden md:flex" : "flex"}
        `}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800 bg-black/40 pt-safe-top">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">
                {viewMode === "search" ? "Buscar Personas" : "Chats"}
              </h2>
              <div className="flex gap-2">
                {/* Requests Badge */}
                {pendingRequests.length > 0 && (
                  <button
                    onClick={() =>
                      setViewMode(
                        viewMode === "requests" ? "chats" : "requests",
                      )
                    }
                    className="p-2 relative bg-brand-gold/10 rounded-full text-brand-gold"
                  >
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border border-black"></span>
                  </button>
                )}
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Edit3 className="w-5 h-5 text-brand-gold" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar amigos por @usuario..."
                className="w-full pl-9 pr-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-gold/50"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-brand-gold" />
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* VIEW: REQUESTS */}
            {viewMode === "requests" && (
              <div className="p-4 space-y-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase">
                  Solicitudes Pendientes
                </h3>
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 bg-gray-900 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                        <User2Icon className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {req.requester.full_name || req.requester.username}
                        </p>
                        <p className="text-xs text-gray-400">
                          @{req.requester.username}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAcceptRequest(req.id)}
                      className="p-2 bg-brand-gold text-brand-black rounded-lg hover:bg-brand-gold/80"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {pendingRequests.length === 0 && (
                  <p className="text-center text-gray-500 mt-4">
                    No tienes solicitudes pendientes.
                  </p>
                )}
              </div>
            )}

            {/* VIEW: SEARCH RESULTS */}
            {viewMode === "search" && (
              <div className="p-4 space-y-2">
                {searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-8 text-gray-500">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No se encontraron usuarios</p>
                  </div>
                )}
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-900 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 overflow-hidden">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <User2Icon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {user.full_name}
                        </p>
                        <p className="text-xs text-brand-gold">
                          @{user.username}
                        </p>
                      </div>
                    </div>

                    {/* Action Button */}
                    {user.friendshipStatus === "accepted" ? (
                      <button
                        onClick={() => startChatWithFriend(user.id)}
                        className="p-2 bg-gray-800 rounded-full text-green-500"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    ) : user.friendshipStatus === "pending" ? (
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                        Pendiente
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSendFriendRequest(user.id)}
                        className="p-2 bg-brand-gold/10 text-brand-gold rounded-full hover:bg-brand-gold hover:text-brand-black transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* VIEW: CHATS & CONTACTS */}
            {viewMode === "chats" && (
              <>
                {/* Active Rooms */}
                {rooms.map((room) => {
                  const info = getRoomInfo(room);
                  const isActive = activeChat === room.id;
                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        setActiveChat(room.id);
                        setMobileShowChat(true);
                      }}
                      className={`flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-gray-800/50 hover:bg-gray-800/30 ${isActive ? "bg-brand-gold/10 border-l-4 border-l-brand-gold" : ""}`}
                    >
                      <div className="w-12 h-12 rounded-full bg-brand-gold/20 flex items-center justify-center border border-brand-gold/30 overflow-hidden">
                        {info.avatar ? (
                          <img
                            src={info.avatar}
                            alt={info.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Users className="w-6 h-6 text-brand-gold" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-white text-base truncate">
                            {info.name}
                          </h3>
                          <span className="text-xs text-gray-500">12:30</span>
                        </div>
                        <p className="text-sm text-gray-400 truncate">
                          {room.last_message || "Iniciar conversación"}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Empty State */}
                {rooms.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <p className="mb-4">No tienes chats activos.</p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        // Just focus search input? Or show friends list?
                        // For now, let's list Friends if no chats.
                      }}
                      className="text-brand-gold hover:underline"
                    >
                      Busca amigos para chatear
                    </button>
                  </div>
                )}

                {/* Friends List (Quick Access) */}
                {friends.length > 0 && (
                  <div className="mt-6 px-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
                      Mis Amigos
                    </h3>
                    <div className="space-y-2">
                      {friends.map((friend) => (
                        <div
                          key={friend.id}
                          onClick={() => startChatWithFriend(friend.id)}
                          className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-800 border-gray-600 border flex items-center justify-center">
                            {friend.avatar_url ? (
                              <img
                                src={friend.avatar_url}
                                className="w-full h-full rounded-full"
                              />
                            ) : (
                              <User2Icon className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <span className="text-sm text-gray-300 group-hover:text-white">
                            {friend.full_name || friend.username}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div
          className={`
            flex-col bg-brand-black md:bg-brand-black/80 backdrop-blur-xl border md:border-brand-gold border-none rounded-none md:rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(0,255,255,0.05)] relative w-full
            ${mobileShowChat ? "flex fixed inset-0 z-50 md:static md:z-auto" : "hidden md:flex flex-1"}
        `}
        >
          {activeChat ? (
            (() => {
              const room = rooms.find((r) => r.id === activeChat);
              const otherId = room?.participants.find(
                (p) => p !== currentUserId,
              );
              const isFriend =
                room?.type === "group" || friends.some((f) => f.id === otherId);

              // Block if not friend (and not group)
              if (!isFriend && room) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                    <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800">
                      <Users className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                      <h3 className="text-xl font-bold text-white mb-2">
                        Chat Bloqueado
                      </h3>
                      <p className="mb-6">
                        Debes ser amigo de este usuario para chatear.
                      </p>
                      <button
                        onClick={() => {
                          // Search for them? Or just go back?
                          setViewMode("search");
                          setMobileShowChat(false);
                        }}
                        className="px-6 py-2 bg-brand-gold text-brand-black rounded-full font-bold hover:bg-white transition-colors"
                      >
                        Buscar Amigos
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  {/* Header */}
                  <div className="h-16 flex items-center justify-between px-4 bg-black/40 border-b border-brand-gold/20">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setMobileShowChat(false)}
                        className="md:hidden text-gray-400 hover:text-white"
                      >
                        <ArrowLeft className="w-6 h-6" />
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center border border-brand-gold/30">
                          <Users className="w-5 h-5 text-brand-gold" />
                        </div>
                        <div>
                          <h2 className="font-bold text-white">
                            {room?.name || getRoomInfo(room!).name}
                          </h2>
                          <p className="text-xs text-green-500 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            En línea
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleStartCall}
                        className="p-2 hover:bg-gray-800 rounded-full text-cyan-400"
                      >
                        <Video className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowWhiteboard(!showWhiteboard)}
                        className={`p-2 rounded-full hover:bg-gray-800 ${showWhiteboard ? "text-brand-gold bg-brand-gold/10" : "text-purple-400"}`}
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  {showWhiteboard ? (
                    <div className="flex-1 relative bg-white">
                      <Whiteboard roomId={activeChat} />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-transparent to-black/50">
                      {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <p>Comienza la conversación...</p>
                        </div>
                      )}
                      <AnimatePresence>
                        {messages.map((msg) => {
                          const isOwn = msg.user_id === currentUserId;
                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
                            >
                              <div className="w-8 h-8 rounded-full bg-gray-800 flex-shrink-0 overflow-hidden border border-gray-700">
                                {msg.profiles?.avatar_url ? (
                                  <img
                                    src={msg.profiles.avatar_url}
                                    className="w-full h-full"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <User2Icon className="w-4 h-4 text-gray-500" />
                                  </div>
                                )}
                              </div>
                              <div
                                className={`max-w-[70%] p-3 rounded-2xl ${isOwn ? "bg-brand-gold text-black rounded-br-none" : "bg-gray-900 text-gray-200 border border-gray-800 rounded-bl-none"}`}
                              >
                                {!isOwn && (
                                  <p className="text-xs font-bold mb-1 opacity-70">
                                    {msg.profiles?.full_name}
                                  </p>
                                )}
                                <p className="text-sm">{msg.content}</p>
                                <p className="text-[10px] opacity-50 text-right mt-1">
                                  {new Date(msg.created_at).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>
                  )}

                  {/* Input */}
                  {!showWhiteboard && (
                    <div className="p-4 bg-black/60 border-t border-gray-800">
                      <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Escribe un mensaje..."
                          className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-white focus:border-brand-gold focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!input.trim()}
                          className="p-2 bg-brand-gold rounded-full text-black hover:bg-white transition-colors disabled:opacity-50"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </form>
                    </div>
                  )}
                </>
              );
            })()
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
              <MessageCircle className="w-16 h-16 mb-4" />
              <p>Selecciona un chat o busca amigos para comenzar</p>
            </div>
          )}
        </div>
      </div>

      {/* Video Overlay */}
      {showVideo && videoUrl && (
        <DailyVideo
          roomUrl={videoUrl}
          onLeave={() => {
            setShowVideo(false);
            setVideoUrl(null);
          }}
        />
      )}
    </div>
  );
}
