"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  ChevronLeft,
  UserPlus,
  Check,
  X,
  Lock,
  Paperclip,
  Image as ImageIcon,
  Trash2,
  Edit2,
  Phone,
  PhoneOff,
  Ban,
  CheckCheck,
  Plus,
  Mic,
  MicOff,
  FileText,
  Music,
  StopCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ClientDate from "@/components/ClientDate";
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
import UserInfoPanel from "@/components/chat/UserInfoPanel";
import ToastContainer, { Toast } from "@/components/ToastContainer";
import Loading from "@/app/loading";

const VideoRoom = dynamic(() => import("@/components/VideoRoom"), {
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
  participants_profiles?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    school?: string;
    grade?: string;
    role?: string;
    username?: string;
  }[];
  last_message?: string;
  updated_at: string;
  avatar_url?: string | null;
  description?: string | null;
  admins?: string[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(
    null,
  );

  // Data State
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Navigation State
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // New Tab State
  const [sidebarTab, setSidebarTab] = useState<"chats" | "friends" | "search">(
    "chats",
  );
  // Local Filter
  const [localFilter, setLocalFilter] = useState("");
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Group Modal State
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // User Profile Modal State
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [activeUserTarget, setActiveUserTarget] = useState<any>(null);

  // Message Actions State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingMediaType, setUploadingMediaType] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pending file preview (before send)
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (message: string, type: Toast["type"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ... (scrollToBottom and initial useEffects remain same, skipping to keep context)

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

      // Fetch current user profile — direct client query, no server round-trip
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) setCurrentProfile(profile);

      try {
        // Fetch friends, rooms, and pending requests via direct client queries
        const [
          { data: friendships },
          { data: myRooms },
          { data: pendingReqs },
        ] = await Promise.all([
          supabase
            .from("friendships")
            .select("id, requester_id, addressee_id")
            .eq("status", "accepted")
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
          supabase
            .from("chat_rooms")
            .select("*")
            .filter("participants", "cs", `{${user.id}}`)
            .order("updated_at", { ascending: false }),
          supabase
            .from("friendships")
            .select("id, created_at, requester_id")
            .eq("status", "pending")
            .eq("addressee_id", user.id),
        ]);

        // Map friend IDs and fetch profiles
        if (friendships && friendships.length > 0) {
          const friendIds = friendships.map((f: any) =>
            f.requester_id === user.id ? f.addressee_id : f.requester_id,
          );
          const { data: friendProfiles } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, school, grade, role")
            .in("id", friendIds);

          const profileMap = new Map(
            (friendProfiles || []).map((p: any) => [p.id, p]),
          );
          setFriends(
            friendships.map((f: any) => {
              const fid =
                f.requester_id === user.id ? f.addressee_id : f.requester_id;
              const p = profileMap.get(fid) as any;
              return {
                friendshipId: f.id,
                id: fid,
                username: p?.username || "Usuario",
                full_name: p?.full_name || "Desconocido",
                avatar_url: p?.avatar_url,
                school: p?.school,
                grade: p?.grade,
                role: p?.role,
              };
            }),
          );
        }

        if (myRooms) setRooms(myRooms as any);

        if (pendingReqs && pendingReqs.length > 0) {
          const reqIds = pendingReqs.map((r: any) => r.requester_id);
          const { data: reqProfiles } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", reqIds);
          const reqProfileMap = new Map(
            (reqProfiles || []).map((p: any) => [p.id, p]),
          );
          setPendingRequests(
            pendingReqs.map((r: any) => ({
              id: r.id,
              created_at: r.created_at,
              requester: reqProfileMap.get(r.requester_id) || {
                id: r.requester_id,
                full_name: "Desconocido",
              },
            })),
          );
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        setTimeout(() => {
          setInitialLoading(false);
        }, 2000);
      }
    };
    initData();

    // 2. Realtime Subscription for Chat Rooms (List)
    // IMPORTANT: Use direct client query — NOT server action — to avoid round-trip latency
    const refreshRooms = async (userId: string) => {
      const { data: rooms } = await supabase
        .from("chat_rooms")
        .select("*")
        .filter("participants", "cs", `{${userId}}`)
        .order("updated_at", { ascending: false });
      if (rooms) setRooms(rooms as any);
    };

    const channel = supabase
      .channel("chat_rooms_list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_rooms",
        },
        async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) refreshRooms(user.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleSendRequest = async (targetId: string) => {
    try {
      const res = await sendFriendRequest(targetId);
      if (res.success) {
        addToast("Solicitud enviada", "success");
        // Update local state to reflect pending status
        setSearchResults((prev) =>
          prev.map((u) =>
            u.id === targetId ? { ...u, friendshipStatus: "pending" } : u,
          ),
        );
      } else {
        addToast(res.message || "Error al enviar solicitud", "info");
      }
    } catch (error) {
      console.error(error);
      addToast("Error al enviar solicitud", "error");
    }
  };

  // ... (handleDeleteMessage, handleMediaUpload, handleEditMessage remain same)

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
      // Only search globally if we are in search tab
      if (sidebarTab === "search" && searchQuery.length > 2) {
        handleSearch(searchQuery);
      } else if (sidebarTab === "search") {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, sidebarTab]);

  // ... (loadMessages useEffect and others remain same)

  // Load Messages when activeChat changes
  useEffect(() => {
    if (!activeChat) return;

    // Direct client query — no server round-trip
    const loadMessagesForRoom = async (roomId: string) => {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select(
            `*, profiles:user_id (full_name, avatar_url, role, school, grade)`,
          )
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (!error && data) {
          setMessages((data as any).reverse());
        }
      } catch (err) {
        console.error("Error loading messages:", err);
      }
    };

    const init = async () => {
      setInitialLoading(true);
      await loadMessagesForRoom(activeChat);
      markMessagesAsRead(activeChat);
      setInitialLoading(false);
    };

    init();

    // ── Realtime subscription (primary) ──────────────────────────────────────
    const channel = supabase
      .channel(`room:${activeChat}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${activeChat}`,
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
            return;
          }
          // Fetch full message with profile to ensure UI consistency
          const { data } = await supabase
            .from("chat_messages")
            .select(
              `*, profiles:user_id (full_name, avatar_url, role, school, grade)`,
            )
            .eq("id", payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => {
              const index = prev.findIndex((m) => m.id === data.id);
              if (index !== -1) {
                const newMsgs = [...prev];
                newMsgs[index] = data as any;
                return newMsgs;
              }
              return [...prev, data as any];
            });
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }
        },
      )
      .subscribe();

    // ── Polling fallback (30 s) — keeps messages current if WS stales ────────
    const pollInterval = setInterval(() => {
      loadMessagesForRoom(activeChat);
    }, 30_000);

    // ── Page Visibility API — re-fetch when user returns to the tab ──────────
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadMessagesForRoom(activeChat);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // ── Window focus — re-fetch when window regains focus ────────────────────
    const handleFocus = () => loadMessagesForRoom(activeChat);
    window.addEventListener("focus", handleFocus);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [activeChat, supabase]);

  const sendMessage = async () => {
    // If there's a pending file, upload it first
    if (pendingFile) {
      await uploadAndSendFile(pendingFile);
      return;
    }
    if (!input.trim() || !activeChat || !currentUserId) return;
    const content = input.trim();
    setInput("");

    // Optimistic update
    const tempId = crypto.randomUUID();
    const tempMsg: Message = {
      id: tempId,
      content,
      user_id: currentUserId,
      room_id: activeChat,
      created_at: new Date().toISOString(),
      profiles: (currentProfile as any) || undefined, // Optimistically attach our own profile
    };

    setMessages((prev) => [...prev, tempMsg]);

    try {
      await sendMessageAction(activeChat, content, tempId);
    } catch (error) {
      console.error("Error sending message:", error);
      addToast("Error al enviar mensaje", "error");
    }
  };

  const handleStartChat = async (friendId: string) => {
    try {
      // Check locally if room exists — null-safe participants check
      const existingRoom = rooms.find(
        (r) =>
          r.type === "private" &&
          Array.isArray(r.participants) &&
          r.participants.includes(friendId),
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
    // null-safe: participants may be empty after normalization
    const participants = Array.isArray(room.participants)
      ? room.participants
      : [];
    const otherId = participants.find((id) => id !== currentUserId);
    const friend = friends.find((f) => f.id === otherId);
    return {
      name: friend?.full_name || friend?.username || "Usuario",
      avatar_url: friend?.avatar_url ?? null,
      status: "online",
    };
  };

  // State to track if current call is video enabled
  const [isVideoCall, setIsVideoCall] = useState(true);
  const [isCallCreator, setIsCallCreator] = useState(false);

  const startCall = async (videoEnabled: boolean = true) => {
    if (!activeChat) return;
    try {
      // Permissions check
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: true,
      });
      stream.getTracks().forEach((t) => t.stop());

      // LiveKit handles room connection via token - just open the component
      setIsVideoCall(videoEnabled); // Set state
      setIsCallCreator(true);
      setShowVideo(true);

      // Send a call offer message directly to the chat room
      await sendMessageAction(
        activeChat,
        videoEnabled ? "[CALL_OFFER_VIDEO]" : "[CALL_OFFER_VOICE]",
      );
    } catch (e) {
      console.error(e);
      addToast(
        "Error al acceder a los dispositivos. Revisa los permisos.",
        "error",
      );
    }
  };

  // ── File & Media handlers ──────────────────────────────────────────────────
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAndSendFile = async (file: File) => {
    if (!activeChat || !currentUserId) return;
    setUploadingMedia(true);
    if (file.type.startsWith("audio/")) {
      setUploadingMediaType("audio");
    } else if (file.type.startsWith("image/")) {
      setUploadingMediaType("image");
    } else if (file.type.startsWith("video/")) {
      setUploadingMediaType("video");
    } else {
      setUploadingMediaType("file");
    }

    try {
      const url = await uploadChatMedia(file, activeChat);
      let content: string;
      if (file.type.startsWith("image/")) {
        content = `[image]${url}`;
      } else if (file.type.startsWith("video/")) {
        content = `[video]${url}`;
      } else if (file.type.startsWith("audio/")) {
        content = `[audio]${url}`;
      } else {
        content = `[file:${file.name}]${url}`;
      }
      await sendMessageAction(activeChat, content);
    } catch {
      addToast("Error al subir el archivo", "error");
    } finally {
      setUploadingMedia(false);
      setUploadingMediaType(null);
      setPendingFile(null);
    }
  };

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!mediaRecorderRef.current) return; // was cancelled
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const af = new File([blob], `audio_${Date.now()}.webm`, {
          type: "audio/webm",
        });
        await uploadAndSendFile(af);
        mediaRecorderRef.current = null;
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordDuration(0);
      recordTimerRef.current = setInterval(
        () => setRecordDuration((d) => d + 1),
        1000,
      );
    } catch {
      addToast("No se pudo acceder al micrófono", "error");
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordDuration(0);
  };

  const cancelRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordDuration(0);
  };

  // Local Filters
  const filteredRooms = rooms.filter((room) => {
    if (!localFilter) return true;
    const info = getRoomInfo(room);
    return info.name.toLowerCase().includes(localFilter.toLowerCase());
  });

  const filteredFriends = friends.filter((friend) => {
    if (!localFilter) return true;
    const name = friend.full_name || friend.username || "";
    return name.toLowerCase().includes(localFilter.toLowerCase());
  });

  if (initialLoading) {
    return <Loading />;
  }

  return (
    <>
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Mobile Layout Wrapper using dynamic viewport height */}
      <div className="flex h-dvh bg-brand-black overflow-hidden relative">
        {/* Sidebar */}
        <div
          className={`${
            mobileShowChat || showVideo ? "hidden" : "flex"
          } ${showVideo ? "md:hidden" : "md:flex"} w-full md:w-80 border-r border-brand-gold/20 flex-col bg-brand-black/50 backdrop-blur-xl relative z-10 transition-all duration-300`}
        >
          {/* Sidebar Header */}
          <div
            className="px-4 pb-3 border-b border-gray-800/80 bg-brand-black/80 backdrop-blur-xl"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
          >
            <div className="flex items-center justify-between mb-3">
              {/* Back button — top-left, universal */}
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-brand-gold/40 transition-all shrink-0"
                title="Volver al Dashboard"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <h1 className="text-base font-bold text-center flex-1 bg-linear-to-r from-brand-gold via-white to-brand-gold bg-clip-text text-transparent">
                Aprendamos Juntos
              </h1>

              <button
                onClick={() => setShowCreateGroup(true)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-brand-gold hover:bg-brand-gold hover:text-brand-black transition-all shrink-0"
                title="Crear Nuevo Grupo"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-gray-900 rounded-xl">
              <button
                onClick={() => {
                  setSidebarTab("chats");
                  setLocalFilter("");
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  sidebarTab === "chats"
                    ? "bg-brand-gold text-brand-black shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Conversaciones
              </button>
              <button
                onClick={() => {
                  setSidebarTab("friends");
                  setLocalFilter("");
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  sidebarTab === "friends"
                    ? "bg-brand-gold text-brand-black shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Amigos
              </button>
              <button
                onClick={() => {
                  setSidebarTab("search");
                  setLocalFilter("");
                  setSearchQuery("");
                }}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                  sidebarTab === "search"
                    ? "bg-brand-gold text-brand-black shadow-lg"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Buscar
              </button>
            </div>

            {/* Dynamic Search/Filter Bar */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-brand-gold transition-colors" />
              {sidebarTab === "search" ? (
                <input
                  type="text"
                  placeholder="Buscar @usuario..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold/50 transition-all"
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  placeholder={
                    sidebarTab === "chats"
                      ? "Filtrar chats..."
                      : "Filtrar amigos..."
                  }
                  value={localFilter}
                  onChange={(e) => setLocalFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold/50 transition-all"
                />
              )}
            </div>
          </div>

          {/* Sidebar List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {sidebarTab === "search" ? (
              <div className="p-2">
                {searchResults.length === 0 &&
                  searchQuery.length > 2 &&
                  !isSearching && (
                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                      No se encontraron usuarios
                    </div>
                  )}
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 bg-gray-900/40 rounded-xl mx-2 mb-2 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-full bg-gray-800 shrink-0 flex items-center justify-center overflow-hidden">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Users className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm truncate">
                          {user.full_name}
                        </h3>
                        <p className="text-xs text-gray-500 truncate bg-black/30 rounded px-1 inline-block">
                          @{user.username}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      {user.friendshipStatus === "accepted" ? (
                        <button
                          onClick={() => handleStartChat(user.id)}
                          className="p-2 bg-brand-gold text-brand-black rounded-full hover:bg-white transition-colors"
                          title="Enviar Mensaje"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      ) : user.friendshipStatus === "pending" ? (
                        <button
                          disabled
                          className="px-3 py-1 bg-gray-800 text-gray-400 text-xs rounded-full cursor-not-allowed border border-gray-700"
                        >
                          Pendiente
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSendRequest(user.id)}
                          className="px-3 py-1 bg-brand-gold/10 text-brand-gold border border-brand-gold/50 text-xs rounded-full hover:bg-brand-gold hover:text-brand-black transition-all"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : sidebarTab === "chats" ? (
              <div className="p-2 space-y-1">
                {filteredRooms.length === 0 ? (
                  <div className="px-4 py-12 text-center text-gray-400">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>
                      {localFilter
                        ? "No hay chats que coincidan"
                        : "No hay conversaciones"}
                    </p>
                  </div>
                ) : (
                  filteredRooms.map((room) => {
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
                                <ClientDate
                                  dateString={room.updated_at}
                                  format="short"
                                  className="text-[10px] text-gray-500"
                                />
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
                {filteredFriends.length === 0 ? (
                  <div className="px-4 py-12 text-center text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>
                      {localFilter
                        ? "No hay amigos que coincidan"
                        : "No tienes amigos agregados"}
                    </p>
                  </div>
                ) : (
                  filteredFriends.map((friend) => (
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
                <VideoRoom
                  roomName={`learn-up-${activeChat}`}
                  username={currentProfile?.full_name || "Usuario"}
                  role={currentProfile?.role || "estudiante"}
                  isCreator={isCallCreator}
                  onLeave={async () => {
                    setShowVideo(false);
                    setShowWhiteboard(false);
                    await sendMessageAction(
                      activeChat,
                      isVideoCall ? "[CALL_ENDED_VIDEO]" : "[CALL_ENDED_VOICE]",
                    );
                  }}
                  videoEnabled={isVideoCall}
                />
                <AnimatePresence>
                  {showWhiteboard && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-4 md:inset-12 z-60 bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-brand-gold"
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
                <div
                  className="px-4 pb-3 border-b border-gray-800 flex items-center justify-between bg-brand-black/95 backdrop-blur-xl z-20 shrink-0"
                  style={{
                    paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
                  }}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setMobileShowChat(false)}
                      className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-brand-gold/40 transition-all shrink-0"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    {(() => {
                      const activeRoom = rooms.find((r) => r.id === activeChat);
                      if (!activeRoom) return null;

                      // Use fetch profiles if available, fallback to existing logic
                      let name = activeRoom.name;
                      let avatarUrl = activeRoom.avatar_url;
                      let statusInfo = "";
                      let userTarget: any = null;

                      if (activeRoom.type === "private") {
                        // null-safe participants access
                        const participants = Array.isArray(
                          activeRoom.participants,
                        )
                          ? activeRoom.participants
                          : [];
                        const otherId = participants.find(
                          (id) => id !== currentUserId,
                        );
                        // Try to find in room profiles first (more reliable)
                        const profile = activeRoom.participants_profiles?.find(
                          (p) => p.id === otherId,
                        );
                        // Fallback to friends list
                        const friend = friends.find((f) => f.id === otherId);

                        userTarget = profile || friend;

                        if (userTarget) {
                          name = userTarget.full_name;
                          avatarUrl = userTarget.avatar_url;
                          if (userTarget.school) {
                            statusInfo = `${userTarget.school} ${userTarget.grade ? `| ${userTarget.grade}` : ""}`;
                          }
                        }
                      }

                      return (
                        <div
                          className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-all"
                          onClick={() => {
                            if (activeRoom.type === "group") {
                              setShowGroupInfo(true);
                            } else if (userTarget) {
                              setActiveUserTarget(userTarget);
                              setShowUserInfo(true);
                            }
                          }}
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center">
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Users className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <h2 className="font-bold text-white flex items-center gap-2">
                              {name}
                              {activeRoom.type === "group" && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-brand-gold/20 text-brand-gold rounded font-mono uppercase">
                                  GRUPO
                                </span>
                              )}
                            </h2>
                            {activeRoom.type === "private" && statusInfo && (
                              <p className="text-xs text-brand-gold/80 flex items-center gap-1">
                                {statusInfo}
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
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('/grid-pattern.svg')] bg-opacity-5">
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
                                  className="rounded-lg max-w-full cursor-pointer max-h-60 object-cover"
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
                                  className="rounded-lg max-w-full max-h-60"
                                />
                              ) : msg.content.startsWith("[audio]") ? (
                                <div className="flex flex-col gap-1">
                                  <p className="text-[10px] opacity-70 flex items-center gap-1 mb-1">
                                    <span>🎤</span> Mensaje de voz
                                  </p>
                                  <audio
                                    src={msg.content.replace("[audio]", "")}
                                    controls
                                    className="max-w-full"
                                    style={{ height: 36 }}
                                  />
                                </div>
                              ) : msg.content.startsWith("[file:") ? (
                                <a
                                  href={msg.content.replace(
                                    /^\[file:[^\]]*\]/,
                                    "",
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm underline"
                                >
                                  <span>📄</span>
                                  {msg.content.match(
                                    /^\[file:([^\]]+)\]/,
                                  )?.[1] || "Archivo"}
                                </a>
                              ) : msg.content.includes("youtube.com/watch") ||
                                msg.content.includes("youtu.be/") ? (
                                (() => {
                                  const regExp =
                                    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                                  const match = msg.content.match(regExp);
                                  const embedId =
                                    match && match[2].length === 11
                                      ? match[2]
                                      : null;

                                  if (embedId) {
                                    return (
                                      <div className="flex flex-col gap-2 w-full max-w-[320px]">
                                        <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                                          <iframe
                                            src={`https://www.youtube.com/embed/${embedId}`}
                                            className="absolute top-0 left-0 w-full h-full"
                                            title="YouTube Video"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                          ></iframe>
                                        </div>
                                        {msg.content !==
                                          `https://youtube.com/watch?v=${embedId}` &&
                                          msg.content !==
                                            `https://youtu.be/${embedId}` && (
                                            <p className="whitespace-pre-wrap wrap-break-word leading-relaxed text-[15px]">
                                              {msg.content}
                                            </p>
                                          )}
                                      </div>
                                    );
                                  }
                                  return (
                                    <p className="whitespace-pre-wrap wrap-break-word leading-relaxed text-[15px]">
                                      {msg.content}
                                    </p>
                                  );
                                })()
                              ) : msg.content === "[CALL_OFFER_VIDEO]" ||
                                msg.content === "[CALL_OFFER_VOICE]" ? (
                                (() => {
                                  const isCallActive = !messages
                                    .slice(messages.indexOf(msg) + 1)
                                    .some(
                                      (m) =>
                                        m.content.startsWith("[CALL_ENDED") ||
                                        m.content.startsWith("[CALL_REJECTED"),
                                    );

                                  return (
                                    <div className="flex flex-col gap-2 min-w-[200px] sm:min-w-[240px]">
                                      <div className="flex items-center gap-2 font-bold mb-1">
                                        {msg.content ===
                                        "[CALL_OFFER_VIDEO]" ? (
                                          <Video
                                            className={`w-5 h-5 ${isCallActive ? "text-green-400" : "text-gray-500"}`}
                                          />
                                        ) : (
                                          <Phone
                                            className={`w-5 h-5 ${isCallActive ? "text-green-400" : "text-gray-500"}`}
                                          />
                                        )}
                                        <span
                                          className={
                                            isCallActive ? "" : "text-gray-400"
                                          }
                                        >
                                          {msg.content === "[CALL_OFFER_VIDEO]"
                                            ? "Videollamada Entrante"
                                            : "Llamada de Voz Entrante"}
                                        </span>
                                      </div>
                                      {!isMe ? (
                                        isCallActive ? (
                                          <div className="flex gap-2 mt-2">
                                            <button
                                              onClick={() => {
                                                setIsVideoCall(
                                                  msg.content ===
                                                    "[CALL_OFFER_VIDEO]",
                                                );
                                                setIsCallCreator(false);
                                                setShowVideo(true);
                                              }}
                                              className="py-2 bg-green-600 hover:bg-green-500 rounded-xl text-white font-bold text-sm flex-1 transition-all shadow-lg hover:scale-105"
                                            >
                                              Aceptar
                                            </button>
                                            <button
                                              onClick={async () => {
                                                await sendMessageAction(
                                                  activeChat as string,
                                                  msg.content ===
                                                    "[CALL_OFFER_VIDEO]"
                                                    ? "[CALL_REJECTED_VIDEO]"
                                                    : "[CALL_REJECTED_VOICE]",
                                                );
                                              }}
                                              className="py-2 bg-red-600/80 hover:bg-red-500 rounded-xl text-white font-bold text-sm flex-1 transition-colors"
                                            >
                                              Rechazar
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="mt-2 py-2 bg-gray-800/50 rounded-xl text-gray-400 font-bold text-sm flex justify-center items-center gap-2 border border-gray-700">
                                            <PhoneOff className="w-4 h-4" />{" "}
                                            Llamada Finalizada
                                          </div>
                                        )
                                      ) : (
                                        <span className="text-sm opacity-70 italic border-l-2 pl-2 border-brand-gold mt-1 block">
                                          {isCallActive
                                            ? "Esperando respuesta..."
                                            : "Llamada Terminada"}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : msg.content.startsWith("[CALL_ENDED") ||
                                msg.content.startsWith("[CALL_REJECTED") ? (
                                <div className="flex items-center gap-2 text-sm italic opacity-80 min-w-[200px]">
                                  <PhoneOff className="w-4 h-4 text-red-400" />
                                  <span>
                                    {msg.content.includes("VIDEO")
                                      ? "Videollamada "
                                      : "Llamada de Voz "}
                                    {msg.content.includes("REJECTED")
                                      ? "Rechazada"
                                      : "Finalizada"}
                                  </span>
                                </div>
                              ) : (
                                <p className="whitespace-pre-wrap wrap-break-word leading-relaxed text-[15px]">
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

                {/* ── Input Area ── */}
                <div className="p-4 bg-brand-black border-t border-gray-800 fixed bottom-0 left-0 w-full md:sticky md:bottom-0 md:w-auto z-40 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4">
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

                  {/* ── File preview bar ── */}
                  {pendingFile && (
                    <div className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded-xl border border-brand-gold/30 mb-2">
                      {pendingFile.type.startsWith("image/") ? (
                        <img
                          src={URL.createObjectURL(pendingFile)}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-700"
                          alt="preview"
                        />
                      ) : pendingFile.type.startsWith("video/") ? (
                        <video
                          src={URL.createObjectURL(pendingFile)}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-700"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700 text-lg">
                          {pendingFile.type.includes("pdf")
                            ? "📄"
                            : pendingFile.type.includes("audio")
                              ? "🎵"
                              : "📎"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">
                          {pendingFile.name}
                        </p>
                        <p className="text-gray-500 text-[10px]">
                          {(pendingFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => setPendingFile(null)}
                        className="p-1 hover:bg-red-500/20 rounded-full text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* ── Voice recording indicator ── */}
                  {isRecording && (
                    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-xl mb-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-red-400 text-xs font-semibold flex-1">
                        Grabando audio... {recordDuration}s
                      </span>
                      <button
                        onClick={cancelRecording}
                        className="text-red-400 hover:text-red-300 text-xs font-bold hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* ── File Upload indicator ── */}
                  {uploadingMedia && uploadingMediaType && (
                    <div className="flex items-center gap-3 bg-brand-gold/10 border border-brand-gold/30 px-3 py-2 rounded-xl mb-2">
                      <Loader2 className="w-4 h-4 text-brand-gold animate-spin" />
                      <span className="text-brand-gold text-xs font-semibold flex-1">
                        {uploadingMediaType === "audio"
                          ? "Enviando audio..."
                          : uploadingMediaType === "image"
                            ? "Enviando imagen..."
                            : uploadingMediaType === "video"
                              ? "Enviando video..."
                              : "Enviando archivo..."}
                      </span>
                    </div>
                  )}

                  <div className="relative flex items-end gap-2 bg-gray-900/50 p-2 rounded-2xl border border-gray-800 focus-within:border-brand-gold/50 transition-colors">
                    {/* Paperclip — all file types */}
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
                      accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
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
                      placeholder={
                        isRecording
                          ? "Grabando audio..."
                          : "Escribe un mensaje..."
                      }
                      disabled={isRecording}
                      className="flex-1 bg-transparent border-none text-white placeholder-gray-500 min-h-[44px] max-h-32 py-3 px-2 focus:ring-0 resize-none custom-scrollbar leading-normal disabled:opacity-50"
                      rows={1}
                    />

                    {/* Mic button — hold to record / tap to toggle */}
                    {!editingMessageId && (
                      <button
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`p-3 rounded-full transition-colors ${
                          isRecording
                            ? "bg-red-500/20 text-red-400 animate-pulse"
                            : "text-gray-400 hover:text-brand-gold hover:bg-brand-gold/10"
                        }`}
                        title={
                          isRecording ? "Detener grabación" : "Grabar audio"
                        }
                      >
                        {isRecording ? (
                          <StopCircle className="w-5 h-5" />
                        ) : (
                          <Mic className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() =>
                        editingMessageId
                          ? handleEditMessage(editingMessageId, editContent)
                          : sendMessage()
                      }
                      disabled={
                        uploadingMedia ||
                        isRecording ||
                        (editingMessageId
                          ? !editContent
                          : !input && !pendingFile)
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

        {showUserInfo && activeUserTarget && (
          <UserInfoPanel
            isOpen={showUserInfo}
            onClose={() => setShowUserInfo(false)}
            user={activeUserTarget}
          />
        )}
      </div>
    </>
  );
}
