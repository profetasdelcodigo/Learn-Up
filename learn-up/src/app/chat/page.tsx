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
  getUserRooms,
  ensurePrivateRoom,
  updateMessage,
  deleteMessage,
  uploadChatMedia,
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

    // Global notification subscription for messages in other chats
    const notificationChannel = supabase
      .channel("global-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          const newMessage = payload.new as any;

          // Only notify if message is NOT from current chat and NOT from current user
          if (
            newMessage.room_id !== activeChat &&
            newMessage.user_id !== currentUserId
          ) {
            // Fetch sender info
            const { data: sender } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", newMessage.user_id)
              .single();

            // Fetch room info
            const { data: room } = await supabase
              .from("chat_rooms")
              .select("name, type, participants")
              .eq("id", newMessage.room_id)
              .single();

            const senderName = sender?.full_name || "Alguien";
            const roomName = room?.name || "un chat";

            // Show toast
            addToast(
              `${senderName} en ${roomName}: ${newMessage.content.substring(0, 50)}...`,
              "info",
            );

            // Insert notification in database
            await supabase.from("notifications").insert({
              user_id: currentUserId,
              type: "message",
              title: `Nuevo mensaje de ${senderName}`,
              message: newMessage.content.substring(0, 100),
              sender_id: newMessage.user_id,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(notificationChannel);
    };
  }, [activeChat, supabase]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Actions
  const handleStartCall = async (withVideo: boolean = true) => {
    if (!activeChat) return;

    try {
      // Request permissions before creating room
      const constraints = withVideo
        ? { video: true, audio: true }
        : { audio: true };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        // Stop the stream immediately, we just needed to check permissions
        stream.getTracks().forEach((track) => track.stop());
      } catch (permError) {
        alert(
          `No se pudo acceder a ${withVideo ? "la cámara/micrófono" : "el micrófono"}. Por favor, permite el acceso en tu navegador.`,
        );
        return;
      }

      const roomName = `room-${activeChat}`;
      const { url } = await createDailyRoom({ name: roomName });
      setVideoUrl(url);
      setShowVideo(true);
      setShowWhiteboard(true); // Show whiteboard when call starts
    } catch (error) {
      console.error("Error starting call:", error);
      alert("Error al iniciar la llamada");
    }
  };

  const handleStartAudioCall = () => handleStartCall(false);
  const handleStartVideoCall = () => handleStartCall(true);

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
      status: null,
    };
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
      </div>
    );
  }

  // Message Action Handlers
  const handleEditMessage = async () => {
    if (!editingMessageId || !editContent.trim()) return;

    try {
      await updateMessage(editingMessageId, editContent.trim());
      setEditingMessageId(null);
      setEditContent("");
    } catch (error) {
      console.error("Error editing message:", error);
      alert("Error al editar el mensaje");
    }
  };

  const handleDeleteMessage = async (
    messageId: string,
    forEveryone: boolean,
  ) => {
    try {
      await deleteMessage(messageId, forEveryone);
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Error al eliminar el mensaje");
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    // Validate file type
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
    ];
    if (!validTypes.includes(file.type)) {
      alert("Tipo de archivo no válido. Solo se permiten imágenes y videos.");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("El archivo es demasiado grande. Máximo 10MB.");
      return;
    }

    setUploadingMedia(true);
    try {
      const mediaUrl = await uploadChatMedia(file, activeChat);

      // Send message with media URL
      const isImage = file.type.startsWith("image/");
      const mediaType = isImage ? "image" : "video";
      const messageContent = `[${mediaType}]${mediaUrl}`;

      await supabase.from("chat_messages").insert({
        room_id: activeChat,
        user_id: currentUserId,
        content: messageContent,
      });
    } catch (error) {
      console.error("Error uploading media:", error);
      alert("Error al subir el archivo");
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const renderMessageContent = (content: string) => {
    // Check if message contains media
    const imageMatch = content.match(/^\[image\](.+)$/);
    const videoMatch = content.match(/^\[video\](.+)$/);

    if (imageMatch) {
      return (
        <img
          src={imageMatch[1]}
          alt="Imagen compartida"
          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(imageMatch[1], "_blank")}
        />
      );
    }

    if (videoMatch) {
      return (
        <video src={videoMatch[1]} controls className="max-w-xs rounded-lg" />
      );
    }

    return <p className="text-sm leading-relaxed break-words">{content}</p>;
  };

  return (
    <div className="min-h-screen bg-brand-black pb-16 md:pb-6 md:p-6 overflow-hidden">
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
                {viewMode === "search" ? "Buscar" : "Mensajería"}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors tooltip"
                  title="Crear Nuevo Grupo"
                >
                  <UserPlus className="w-5 h-5 text-brand-gold" />
                </button>
              </div>
            </div>

            {/* Tab Switcher */}
            {viewMode !== "search" && (
              <div className="flex p-1 bg-gray-900 rounded-xl mb-4">
                <button
                  onClick={() => setSidebarTab("chats")}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    sidebarTab === "chats"
                      ? "bg-brand-black text-brand-gold shadow-lg border border-brand-gold/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Conversaciones
                </button>
                <button
                  onClick={() => setSidebarTab("friends")}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    sidebarTab === "friends"
                      ? "bg-brand-black text-brand-gold shadow-lg border border-brand-gold/20"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Amigos
                </button>
              </div>
            )}

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  sidebarTab === "friends"
                    ? "Buscar amigo..."
                    : "Buscar chat..."
                }
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
                      onClick={() => handleAcceptRequest(req.requester.id)}
                      className="px-4 py-2 bg-brand-gold text-brand-black rounded-full font-semibold hover:bg-white transition-colors text-sm"
                    >
                      Aceptar
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

            {/* TAB: CHATS */}
            {viewMode === "chats" && sidebarTab === "chats" && (
              <div>
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
                    <p className="mb-4">No tienes conversaciones activas.</p>
                    <button
                      onClick={() => setSidebarTab("friends")}
                      className="text-brand-gold hover:underline"
                    >
                      Ir a Amigos para iniciar una
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: FRIENDS */}
            {viewMode === "chats" && sidebarTab === "friends" && (
              <div className="p-4 space-y-2">
                {friends.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Aún no tienes amigos.</p>
                    <button
                      onClick={() => setViewMode("search")}
                      className="text-brand-gold hover:underline mt-2"
                    >
                      Buscar Personas
                    </button>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      onClick={() => startChatWithFriend(friend.id)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-800 rounded-xl cursor-pointer group transition-colors border border-transparent hover:border-gray-700"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-800 border-gray-600 border flex items-center justify-center overflow-hidden">
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            className="w-full h-full object-cover"
                            alt={friend.username}
                          />
                        ) : (
                          <User2Icon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-200 group-hover:text-white truncate">
                          {friend.full_name || friend.username}
                        </span>
                        <span className="text-xs text-gray-500 truncate">
                          @{friend.username} • {friend.school || "Estudiante"}
                        </span>
                      </div>
                      <MessageCircle className="w-4 h-4 text-gray-500 group-hover:text-brand-gold" />
                    </div>
                  ))
                )}
              </div>
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
                    <div className="bg-gray-900 p-8 rounded-3xl border border-brand-gold/30 max-w-md">
                      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-brand-gold/10 border-2 border-brand-gold flex items-center justify-center">
                        <Lock className="w-10 h-10 text-brand-gold" />
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-3">
                        🔒 Chat Bloqueado
                      </h3>
                      <p className="text-gray-300 mb-6 leading-relaxed">
                        Debes ser amigo de este usuario para desbloquear el{" "}
                        <strong className="text-brand-gold">chat</strong>,{" "}
                        <strong className="text-cyan-400">videollamadas</strong>{" "}
                        y{" "}
                        <strong className="text-purple-400">
                          pizarra colaborativa
                        </strong>
                        .
                      </p>
                      <button
                        onClick={() => {
                          setViewMode("search");
                          setMobileShowChat(false);
                        }}
                        className="px-6 py-3 bg-brand-gold text-brand-black rounded-full font-bold hover:bg-white transition-all shadow-lg"
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
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => setMobileShowChat(false)}
                        className="md:hidden p-2 -ml-2 text-brand-gold hover:bg-white/10 rounded-full transition-colors"
                      >
                        <ArrowLeft className="w-6 h-6" />
                      </button>
                      <div
                        className={`flex items-center gap-3 flex-1 min-w-0 ${room?.type === "group" ? "cursor-pointer hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg transition-colors" : ""}`}
                        onClick={() =>
                          room?.type === "group" && setShowGroupInfo(true)
                        }
                      >
                        <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center border border-brand-gold/30 overflow-hidden flex-shrink-0">
                          {(() => {
                            const info = getRoomInfo(room!);
                            if (info.avatar) {
                              return (
                                <img
                                  src={info.avatar}
                                  alt={info.name}
                                  className="w-full h-full object-cover"
                                />
                              );
                            }
                            if (room?.type === "group") {
                              return (
                                <Users className="w-5 h-5 text-brand-gold" />
                              );
                            }
                            return (
                              <User2Icon className="w-5 h-5 text-brand-gold" />
                            );
                          })()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="font-bold text-white truncate">
                            {room?.name || getRoomInfo(room!).name}
                          </h2>
                          {room?.type === "private" ? (
                            (() => {
                              const otherUserId = room.participants.find(
                                (p) => p !== currentUserId,
                              );
                              const otherUser = friends.find(
                                (f) => f.id === otherUserId,
                              );
                              return (
                                <p className="text-xs text-gray-400 truncate">
                                  {otherUser?.school || "Estudiante"} •{" "}
                                  {otherUser?.grade || "Grado"}{" "}
                                  {otherUser?.role ? `• ${otherUser.role}` : ""}
                                </p>
                              );
                            })()
                          ) : (
                            <p className="text-xs text-green-500 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                              {room?.participants.length || 0} miembros
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={isFriend ? handleStartAudioCall : undefined}
                        disabled={!isFriend}
                        className={`p-2 rounded-full transition-colors ${
                          isFriend
                            ? "hover:bg-gray-800 text-green-400 cursor-pointer"
                            : "text-gray-600 cursor-not-allowed"
                        }`}
                        title="Llamada de audio"
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                      <button
                        onClick={isFriend ? handleStartVideoCall : undefined}
                        disabled={!isFriend}
                        className={`p-2 rounded-full transition-colors ${
                          isFriend
                            ? "hover:bg-gray-800 text-cyan-400 cursor-pointer"
                            : "text-gray-600 cursor-not-allowed"
                        }`}
                        title="Videollamada"
                      >
                        <Video className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowWhiteboard(!showWhiteboard)}
                        disabled={!isFriend}
                        className={`p-2 rounded-full transition-colors ${
                          !isFriend
                            ? "text-gray-600 cursor-not-allowed"
                            : showWhiteboard
                              ? "text-brand-gold bg-brand-gold/10 hover:bg-brand-gold/20"
                              : "text-purple-400 hover:bg-gray-800"
                        }`}
                        title={
                          !isFriend
                            ? "Debes ser amigo para usar la pizarra"
                            : "Pizarra"
                        }
                      >
                        {!isFriend ? (
                          <Lock className="w-5 h-5 text-brand-gold" />
                        ) : (
                          <Edit3 className="w-5 h-5" />
                        )}
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
                          const isDeleted =
                            msg.is_deleted_for_everyone ||
                            msg.deleted_for?.includes(currentUserId || "");

                          if (isDeleted && !msg.is_deleted_for_everyone)
                            return null; // Hidden for this user only

                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex gap-3 ${isOwn ? "flex-row-reverse" : "flex-row"} group`}
                            >
                              <div className="w-8 h-8 rounded-full bg-gray-800 flex-shrink-0 overflow-hidden border border-gray-700">
                                {msg.profiles?.avatar_url ? (
                                  <img
                                    src={msg.profiles.avatar_url}
                                    className="w-full h-full"
                                    alt="Avatar"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <User2Icon className="w-4 h-4 text-gray-500" />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-1 max-w-[70%]">
                                <div
                                  className={`p-3 rounded-2xl ${isOwn ? "bg-brand-gold text-black rounded-br-none" : "bg-gray-900 text-gray-200 border border-gray-800 rounded-bl-none"}`}
                                >
                                  {!isOwn && (
                                    <div className="mb-1">
                                      <p className="text-xs font-bold text-brand-gold opacity-90">
                                        {msg.profiles?.full_name}
                                      </p>
                                      <p className="text-[10px] text-gray-400">
                                        {msg.profiles?.school || "IE?"} |{" "}
                                        {msg.profiles?.grade || "Grado?"} |{" "}
                                        {msg.profiles?.role === "student"
                                          ? "Estudiante"
                                          : "Docente"}
                                      </p>
                                    </div>
                                  )}

                                  {editingMessageId === msg.id ? (
                                    <div className="space-y-2">
                                      <input
                                        type="text"
                                        value={editContent}
                                        onChange={(e) =>
                                          setEditContent(e.target.value)
                                        }
                                        className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white"
                                        autoFocus
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={handleEditMessage}
                                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                        >
                                          Guardar
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingMessageId(null);
                                            setEditContent("");
                                          }}
                                          className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {msg.is_deleted_for_everyone ? (
                                        <p className="text-sm italic opacity-50">
                                          Este mensaje fue eliminado
                                        </p>
                                      ) : (
                                        renderMessageContent(msg.content)
                                      )}
                                    </>
                                  )}

                                  <div className="flex items-center justify-between mt-1">
                                    <p className="text-[10px] opacity-50">
                                      {new Date(
                                        msg.created_at,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                    {msg.is_edited &&
                                      !msg.is_deleted_for_everyone && (
                                        <span className="text-[10px] opacity-50 ml-2">
                                          (editado)
                                        </span>
                                      )}
                                  </div>
                                </div>

                                {/* Message Actions */}
                                {isOwn &&
                                  !msg.is_deleted_for_everyone &&
                                  editingMessageId !== msg.id && (
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => {
                                          setEditingMessageId(msg.id);
                                          setEditContent(msg.content);
                                        }}
                                        className="p-1 bg-gray-800 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                                        title="Editar"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (
                                            confirm("¿Eliminar para todos?")
                                          ) {
                                            handleDeleteMessage(msg.id, true);
                                          }
                                        }}
                                        className="p-1 bg-gray-800 rounded hover:bg-red-600 text-gray-400 hover:text-white"
                                        title="Eliminar para todos"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteMessage(msg.id, false)
                                        }
                                        className="p-1 bg-gray-800 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                                        title="Eliminar para mí"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
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
                      <form
                        onSubmit={handleSendMessage}
                        className="flex gap-2 items-center"
                      >
                        {/* Hidden file input */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleMediaUpload}
                          className="hidden"
                        />

                        {/* Media upload button */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingMedia}
                          className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 text-gray-400 hover:text-brand-gold transition-colors disabled:opacity-50"
                          title="Subir imagen o video"
                        >
                          {uploadingMedia ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Paperclip className="w-5 h-5" />
                          )}
                        </button>

                        <input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Escribe un mensaje..."
                          className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-4 py-2 text-white focus:border-brand-gold focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!input.trim()}
                          className="p-2 bg-brand-gold rounded-full text-black hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-5 h-5 text-brand-black" />
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

        {/* Modals */}
        <CreateGroupModal
          isOpen={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
          friends={friends}
          onGroupCreated={(roomId) => {
            setActiveChat(roomId);
            setMobileShowChat(true);
            setSidebarTab("chats");
          }}
        />

        {activeChat && rooms.find((r) => r.id === activeChat) && (
          <GroupInfoPanel
            isOpen={showGroupInfo}
            onClose={() => setShowGroupInfo(false)}
            room={rooms.find((r) => r.id === activeChat)!}
            members={friends.filter((f) =>
              rooms
                .find((r) => r.id === activeChat)
                ?.participants.includes(f.id),
            )}
            currentUserId={currentUserId || ""}
            onLeaveGroup={() => {
              setShowGroupInfo(false);
              setActiveChat(null);
            }}
          />
        )}

        <BottomNav />
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
