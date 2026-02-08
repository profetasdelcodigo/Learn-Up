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
  Lock,
  Paperclip,
  Image as ImageIcon,
  Trash2,
  Edit2,
  Phone,
  Ban,
  CheckCheck,
  Plus,
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
import {
  createGroup,
  getUserRooms,
  getChatMessages,
  sendMessage as sendMessageAction,
  markMessagesAsRead,
  updateMessage,
  deleteMessage,
  uploadChatMedia,
  ensurePrivateRoom,
  leaveGroup,
} from "@/actions/chat";
import dynamic from "next/dynamic";
import CreateGroupModal from "@/components/chat/CreateGroupModal";
import GroupInfoPanel from "@/components/chat/GroupInfoPanel";
import ToastContainer, { Toast } from "@/components/ToastContainer";

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
  updated_at?: string;
  is_edited?: boolean;
  is_deleted_for_everyone?: boolean;
  deleted_for?: string[];
  profiles?: {
    full_name: string;
    avatar_url: string | null;
    school?: string;
    grade?: string;
    role?: string;
  };
}

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  friendshipStatus?: string; // for search
  friendshipId?: string; // for actions
  school?: string | null;
  grade?: string | null;
  role?: string | null;
}

interface ChatRoom {
  id: string;
  type: "private" | "group";
  name?: string;
  participants: string[];
  last_message?: string;
  updated_at: string;
  avatar_url?: string | null; // Added to match actions/chat.ts potentially
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
  const [startWithVideo, setStartWithVideo] = useState(true);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // New Tab State
  const [sidebarTab, setSidebarTab] = useState<"chats" | "friends">("chats");
  // Group Modal State
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // Message Actions State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, type: Toast["type"] = "info") => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial Load
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

      // Load friends and rooms
      try {
        const [friendsData, roomsData, requestsData] = await Promise.all([
          getFriends(),
          getUserRooms(),
          getPendingRequests(),
        ]);
        setFriends(friendsData || []);
        setRooms(roomsData || []);
        setPendingRequests(requestsData || []);
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        setInitialLoading(false);
      }
    };
    initData();
  }, [router, supabase]);

  const handleSearch = async (query: string) => {
    if (!query) return;
    setIsSearching(true);
    try {
      const results = await searchUsers(query);
      setSearchResults(results.filter((u) => u.id !== currentUserId));
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Simple confirm for MVP
    if (
      confirm(
        "¿Deseas eliminar este mensaje para todos? (Cancelar para eliminar solo para ti)",
      )
    ) {
      try {
        await deleteMessage(messageId, true);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  is_deleted_for_everyone: true,
                  content: "Este mensaje fue eliminado",
                }
              : msg,
          ),
        );
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        await deleteMessage(messageId, false);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    setUploadingMedia(true);
    try {
      const mediaUrl = await uploadChatMedia(file, activeChat);
      // Send message with media
      const isImage = file.type.startsWith("image/");
      const mediaType = isImage ? "image" : "video";
      const content = `[${mediaType}]${mediaUrl}`;

      await sendMessageAction(activeChat, content);
    } catch (e) {
      console.error("Error uploading media:", e);
      addToast("Error al subir archivo", "error");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleEditMessage = async (id: string, content: string) => {
    try {
      await updateMessage(id, content);
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content, is_edited: true } : m)),
      );
      setEditingMessageId(null);
      setEditContent("");
    } catch (e) {
      console.error(e);
    }
  };

  // Search Logic (Debounce)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Messages when activeChat changes
  useEffect(() => {
    if (!activeChat) return;

    const loadMessages = async () => {
      setInitialLoading(true);
      try {
        const msgs = await getChatMessages(activeChat);
        setMessages(msgs as any);
        markMessagesAsRead(activeChat);
      } catch (error) {
        console.error("Error loading messages:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadMessages();

    // Realtime subscription
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
          // Fetch full message with profile to ensure UI consistency
          const { data } = await supabase
            .from("chat_messages")
            .select(
              `*, profiles:user_id (full_name, avatar_url, role, school, grade)`,
            )
            .eq("id", payload.new.id)
            .single();

          if (data)
            setMessages((prev) => {
              if (prev.find((m) => m.id === data.id)) return prev;
              return [...prev, data as any];
            });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat, supabase]);

  const sendMessage = async () => {
    if (!input.trim() || !activeChat || !currentUserId) return;
    const content = input.trim();
    setInput("");

    // Optimistic update
    const tempId = Math.random().toString();
    const tempMsg: Message = {
      id: tempId,
      content,
      user_id: currentUserId,
      room_id: activeChat,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMsg]);

    try {
      await sendMessageAction(activeChat, content);
    } catch (error) {
      console.error("Error sending message:", error);
      addToast("Error al enviar mensaje", "error");
    }
  };

  const handleStartChat = async (friendId: string) => {
    try {
      // Check locally if room exists
      const existingRoom = rooms.find(
        (r) => r.type === "private" && r.participants.includes(friendId),
      );

      if (existingRoom) {
        setActiveChat(existingRoom.id);
        setMobileShowChat(true);
      } else {
        setInitialLoading(true);
        // Create room on server
        try {
          const roomId = await ensurePrivateRoom(friendId);
          // Refresh rooms
          const updatedRooms = await getUserRooms();
          setRooms(updatedRooms || []);
          setActiveChat(roomId);
          setMobileShowChat(true);
        } catch (e) {
          console.error(e);
          addToast("Error al iniciar chat", "error");
        } finally {
          setInitialLoading(false);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectRoom = (roomId: string) => {
    setActiveChat(roomId);
    setMobileShowChat(true);
  };

  const handleCreateGroup = (roomId: string) => {
    getUserRooms().then((data) => {
      setRooms(data || []);
      setActiveChat(roomId);
      setMobileShowChat(true);
      setShowCreateGroup(false);
    });
  };

  const handleLeaveGroup = async () => {
    if (!activeChat) return;
    if (confirm("¿Estás seguro de que quieres salir del grupo?")) {
      try {
        await leaveGroup(activeChat);
        setActiveChat(null);
        setMobileShowChat(false);
        const updatedRooms = await getUserRooms();
        setRooms(updatedRooms || []);
        addToast("Has salido del grupo", "info");
      } catch (e) {
        console.error(e);
        addToast("Error al salir del grupo", "error");
      }
    }
  };

  const getRoomInfo = (room: ChatRoom) => {
    if (room.type === "group") {
      return {
        name: room.name || "Grupo sin nombre",
        avatar_url: null,
        status: null,
      };
    }
    const otherId = room.participants.find((id) => id !== currentUserId);
    const friend = friends.find((f) => f.id === otherId);
    return {
      name: friend?.full_name || friend?.username || "Usuario",
      avatar_url: friend?.avatar_url,
      status: "online",
    };
  };

  const startCall = async (videoEnabled: boolean = true) => {
    setStartWithVideo(videoEnabled);
    if (!activeChat) return;
    try {
      // Permissions check
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: true,
      });
      stream.getTracks().forEach((t) => t.stop());

      const roomData = await createDailyRoom();
      if (roomData && roomData.url) {
        setVideoUrl(roomData.url);
        setShowVideo(true);
      } else {
        console.error("No se pudo crear la sala");
        addToast("Error al crear la sala de video", "error");
      }
    } catch (e) {
      console.error(e);
      addToast(
        "No se pudo acceder a cámara/micrófono o error al iniciar llamada",
        "error",
      );
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Mobile Layout Wrapper */}
      <div className="flex h-screen bg-brand-black overflow-hidden relative">
        {/* Sidebar */}
        <div
          className={`${
            mobileShowChat ? "hidden" : "flex"
          } md:flex w-full md:w-80 border-r border-brand-gold/20 flex-col bg-brand-black/50 backdrop-blur-xl relative z-10`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-800 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold bg-gradient-to-r from-brand-gold via-white to-brand-gold bg-clip-text text-transparent">
                Mensajes
              </h1>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="p-2 bg-brand-gold/10 text-brand-gold rounded-full hover:bg-brand-gold hover:text-brand-black transition-all shadow-lg hover:shadow-brand-gold/20"
                title="Crear Nuevo Grupo"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-brand-gold transition-colors" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold/50 transition-all"
              />
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-900 rounded-xl">
              <button
                onClick={() => setSidebarTab("chats")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  sidebarTab === "chats"
                    ? "bg-brand-gold text-brand-black shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Conversaciones
              </button>
              <button
                onClick={() => setSidebarTab("friends")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  sidebarTab === "friends"
                    ? "bg-brand-gold text-brand-black shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Amigos
              </button>
            </div>
          </div>

          {/* Sidebar List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isSearching ? (
              <div className="p-2">
                <p className="px-4 py-2 text-xs font-bold text-brand-gold uppercase tracking-wider">
                  Resultados
                </p>
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 hover:bg-white/5 bg-gray-900/40 rounded-xl cursor-pointer transition-all mx-2 mb-1 group"
                    onClick={() => handleStartChat(user.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Users className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">
                          {user.full_name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {user.school || user.username}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : sidebarTab === "chats" ? (
              <div className="p-2 space-y-1">
                {rooms.length === 0 ? (
                  <div className="px-4 py-12 text-center text-gray-400">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay conversaciones</p>
                  </div>
                ) : (
                  rooms.map((room) => {
                    const info = getRoomInfo(room);
                    const isActive = activeChat === room.id;
                    return (
                      <div
                        key={room.id}
                        onClick={() => handleSelectRoom(room.id)}
                        className={`p-3 rounded-xl cursor-pointer transition-all mx-2 group border ${
                          isActive
                            ? "bg-brand-gold/10 border-brand-gold/30 shadow-[0_0_15px_-5px_var(--brand-gold)]"
                            : "border-transparent hover:bg-white/5 hover:border-gray-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 overflow-hidden flex items-center justify-center">
                            {info.avatar_url ? (
                              <img
                                src={info.avatar_url}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Users className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-0.5">
                              <h3
                                className={`font-bold truncate max-w-[70%] ${isActive ? "text-brand-gold" : "text-white"}`}
                              >
                                {info.name}
                              </h3>
                              {room.updated_at && (
                                <span className="text-[10px] text-gray-500">
                                  {new Date(room.updated_at).toLocaleDateString(
                                    undefined,
                                    { month: "short", day: "numeric" },
                                  )}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              {room.last_message || "Iniciar chat..."}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {friends.length === 0 ? (
                  <div className="px-4 py-12 text-center text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No tienes amigos agregados</p>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => handleStartChat(friend.id)}
                      className="p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-all mx-2 group flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-full bg-gray-800 overflow-hidden">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Users className="w-5 h-5 m-3.5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white">
                          {friend.full_name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          @{friend.username}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div
          className={`${
            mobileShowChat ? "flex" : "hidden"
          } md:flex flex-1 flex-col bg-brand-black relative`}
        >
          {activeChat ? (
            showVideo ? (
              <div className="w-full h-full relative">
                <DailyVideo
                  roomUrl={videoUrl || ""}
                  onLeave={() => {
                    setShowVideo(false);
                    setVideoUrl(null);
                    setShowWhiteboard(false);
                  }}
                  onToggleWhiteboard={() => setShowWhiteboard((prev) => !prev)}
                  isWhiteboardOpen={showWhiteboard}
                  startWithVideo={startWithVideo}
                />
                <AnimatePresence>
                  {showWhiteboard && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-4 md:inset-12 z-[60] bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-brand-gold"
                    >
                      <div className="w-full h-full relative">
                        <Whiteboard roomId={activeChat || "temp-room"} />
                        <button
                          onClick={() => setShowWhiteboard(false)}
                          className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full z-10 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-brand-black/95 backdrop-blur-xl z-20">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setMobileShowChat(false)}
                      className="md:hidden p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <ArrowLeft className="w-6 h-6 text-white" />
                    </button>

                    {(() => {
                      const activeRoom = rooms.find((r) => r.id === activeChat);
                      if (!activeRoom) return null;
                      const info = getRoomInfo(activeRoom);

                      // Identity Info logic
                      const otherId = activeRoom.participants.find(
                        (id) => id !== currentUserId,
                      );
                      const friend = friends.find((f) => f.id === otherId);

                      return (
                        <div
                          className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-all"
                          onClick={() =>
                            activeRoom.type === "group" &&
                            setShowGroupInfo(true)
                          }
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center">
                            {info.avatar_url ? (
                              <img
                                src={info.avatar_url}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Users className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <h2 className="font-bold text-white flex items-center gap-2">
                              {info.name}
                              {activeRoom.type === "group" && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-brand-gold/20 text-brand-gold rounded font-mono uppercase">
                                  GRUPO
                                </span>
                              )}
                            </h2>
                            {activeRoom.type === "private" &&
                              friend &&
                              friend.school && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <span className="text-brand-gold/80">
                                    {friend.school}
                                  </span>
                                  {friend.grade && (
                                    <span>
                                      | {friend.grade} (Section {friend.role})
                                    </span>
                                  )}
                                </p>
                              )}
                            {activeRoom.type === "group" && (
                              <p className="text-xs text-gray-400">
                                {activeRoom.participants.length} miembros • Toca
                                para info
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startCall(false)}
                      className="p-2.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-brand-gold"
                      title="Llamada de Voz"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => startCall(true)}
                      className="p-2.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-brand-gold"
                      title="Iniciar Videollamada"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-20">
                  {messages.map((msg) => {
                    const isMe = msg.user_id === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"} group animate-in slide-in-from-bottom-2 duration-300`}
                      >
                        <div
                          className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-sm relative ${
                            isMe
                              ? "bg-brand-gold text-brand-black rounded-tr-sm"
                              : "bg-gray-800 text-white rounded-tl-sm border border-gray-700"
                          }`}
                        >
                          {msg.is_deleted_for_everyone ? (
                            <p className="italic text-sm opacity-70 flex items-center gap-2">
                              <Ban className="w-3 h-3" />
                              {msg.content}
                            </p>
                          ) : (
                            <>
                              {/* Sender Name in One-on-One or Group (mostly for group or received messages) */}
                              {!isMe &&
                                rooms.find((r) => r.id === activeChat)?.type ===
                                  "group" &&
                                msg.profiles && (
                                  <p className="text-[10px] font-bold text-brand-gold mb-1">
                                    {msg.profiles.full_name}
                                  </p>
                                )}

                              {/* Media Rendering Helper */}
                              {msg.content.startsWith("[image]") ? (
                                <img
                                  src={msg.content.replace("[image]", "")}
                                  className="rounded-lg max-w-full cursor-pointer"
                                  onClick={() =>
                                    window.open(
                                      msg.content.replace("[image]", ""),
                                      "_blank",
                                    )
                                  }
                                  alt="media"
                                />
                              ) : msg.content.startsWith("[video]") ? (
                                <video
                                  src={msg.content.replace("[video]", "")}
                                  controls
                                  className="rounded-lg max-w-full"
                                />
                              ) : (
                                <p className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">
                                  {msg.content}
                                </p>
                              )}

                              <div
                                className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${isMe ? "text-brand-black/60" : "text-gray-400"}`}
                              >
                                <span>
                                  {new Date(msg.created_at).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </span>
                                {msg.is_edited && <span>• Editado</span>}
                                {isMe && <CheckCheck className="w-3 h-3" />}
                              </div>
                            </>
                          )}

                          {!msg.is_deleted_for_everyone && isMe && (
                            <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-700 shadow-xl z-10">
                              <button
                                className="p-1 hover:text-brand-gold text-gray-400"
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditContent(msg.content);
                                }}
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                className="p-1 hover:text-red-500 text-gray-400"
                                onClick={() => handleDeleteMessage(msg.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area with Edit/Media */}
                <div className="p-4 bg-brand-black border-t border-gray-800">
                  {editingMessageId && (
                    <div className="flex items-center justify-between bg-brand-gold/10 p-2 px-4 rounded-t-xl border border-brand-gold/20 text-xs mb-2">
                      <span className="text-brand-gold font-bold">
                        Editando mensaje...
                      </span>
                      <button
                        onClick={() => {
                          setEditingMessageId(null);
                          setEditContent("");
                        }}
                      >
                        <X className="w-4 h-4 text-brand-gold" />
                      </button>
                    </div>
                  )}
                  <div className="relative flex items-end gap-2 bg-gray-900/50 p-2 rounded-2xl border border-gray-800 focus-within:border-brand-gold/50 transition-colors">
                    <button
                      className="p-3 text-gray-400 hover:text-brand-gold hover:bg-brand-gold/10 rounded-full transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*,video/*"
                      onChange={handleMediaUpload}
                    />

                    <textarea
                      value={editingMessageId ? editContent : input}
                      onChange={(e) =>
                        editingMessageId
                          ? setEditContent(e.target.value)
                          : setInput(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (editingMessageId) {
                            handleEditMessage(editingMessageId, editContent);
                          } else {
                            sendMessage();
                          }
                        }
                      }}
                      placeholder="Escribe un mensaje..."
                      className="flex-1 bg-transparent border-none text-white placeholder-gray-500 min-h-[44px] max-h-32 py-3 px-2 focus:ring-0 resize-none custom-scrollbar leading-normal"
                      rows={1}
                    />
                    <button
                      onClick={() =>
                        editingMessageId
                          ? handleEditMessage(editingMessageId, editContent)
                          : sendMessage()
                      }
                      disabled={
                        uploadingMedia ||
                        (editingMessageId ? !editContent : !input)
                      }
                      className="p-3 bg-brand-gold text-brand-black rounded-xl hover:bg-white transition-all disabled:opacity-50"
                    >
                      {uploadingMedia ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[url('/grid-pattern.svg')] bg-opacity-5">
              <div className="w-24 h-24 bg-brand-gold/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <MessageCircle className="w-12 h-12 text-brand-gold" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Aprendamos Juntos
              </h2>
              <p className="text-gray-400 max-w-md">
                Selecciona una conversación para empezar a chatear.
              </p>
            </div>
          )}
        </div>

        {/* Modals */}
        <CreateGroupModal
          isOpen={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
          friends={friends}
          onGroupCreated={handleCreateGroup}
        />

        {activeChat && showGroupInfo && (
          <GroupInfoPanel
            isOpen={showGroupInfo}
            onClose={() => setShowGroupInfo(false)}
            room={rooms.find((r) => r.id === activeChat)!}
            members={friends.filter((f) =>
              rooms
                .find((r) => r.id === activeChat)
                ?.participants.includes(f.id),
            )} // Best effort members
            currentUserId={currentUserId!}
            onLeaveGroup={handleLeaveGroup}
          />
        )}
      </div>
    </>
  );
}
