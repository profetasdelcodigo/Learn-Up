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
  Monitor,
  Pin,
  Smile,
  BarChart2,
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
  getRoomMembers,
  pinMessage,
  addMessageReaction,
  removeMessageReaction,
} from "@/actions/chat";
import dynamic from "next/dynamic";
import CreateGroupModal from "@/components/chat/CreateGroupModal";
import GroupInfoPanel from "@/components/chat/GroupInfoPanel";
import UserInfoPanel from "@/components/chat/UserInfoPanel";
import Loading from "@/app/loading";
import { useSetAtom } from "jotai";
import { addToastAtom } from "@/store/ui";

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
  is_pinned?: boolean;
  media_type?: string;
  media_url?: string;
  metadata?: any;
  reactions?: any[];
  profiles?: {
    full_name: string;
    username?: string;
    avatar_url: string | null;
    school?: string;
    grade?: string;
    section?: string;
    role?: string;
    description?: string | null;
    country?: string | null;
    socials?: Record<string, string | null> | null;
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
  section?: string | null;
  role?: string | null;
  description?: string | null;
  country?: string | null;
  socials?: Record<string, string | null> | null;
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
    section?: string;
    role?: string;
    username?: string;
    description?: string | null;
    country?: string | null;
    socials?: Record<string, string | null> | null;
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

  // Room Members State (for read receipts and roles)
  const [roomMembers, setRoomMembers] = useState<any[]>([]);

  // Reactions State
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(null);

  // Data State
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  // Navigation State
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [isMinimizedCall, setIsMinimizedCall] = useState(false);
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

  // Global Toast
  const setAddToast = useSetAtom(addToastAtom);

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

      // 1. Fetch current user profile â€” direct client query
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) setCurrentProfile(profile);

      try {
        // 2. Fetch initial data using Promise.all for speed
        // getUserRooms is a server action that joins participants_profiles
        const [{ data: friendships }, myRooms, { data: pendingReqs }] =
          await Promise.all([
            supabase
              .from("friendships")
              .select("id, requester_id, addressee_id")
              .eq("status", "accepted")
              .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
            getUserRooms(),
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
            .select("*")
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
                section: p?.section,
                role: p?.role,
                description: p?.description,
                country: p?.country,
                socials: p?.socials,
              };
            }),
          );
        }

        if (myRooms) {
          setRooms(myRooms as any);
          if (myRooms.length > 0) {
            setActiveChat((prev) => prev || (myRooms[0] as any).id);
          }
        }

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
        setInitialLoading(false);
      }
    };
    initData();

    // 2. Realtime Subscription for Chat Rooms (List)
    const refreshRooms = async (userId: string) => {
      const roomsData = await getUserRooms();
      if (roomsData) setRooms(roomsData as any);
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
        setAddToast({ message: "Solicitud enviada", type: "success" });
        // Update local state to reflect pending status
        setSearchResults((prev) =>
          prev.map((u) =>
            u.id === targetId ? { ...u, friendshipStatus: "pending" } : u,
          ),
        );
      } else {
        setAddToast({ message: res.message || "Error al enviar solicitud", type: "info" });
      }
    } catch (error) {
      console.error(error);
      setAddToast({ message: "Error al enviar solicitud", type: "error" });
    }
  };

  // ... (handleDeleteMessage, handleMediaUpload, handleEditMessage remain same)

  const handleDeleteMessage = async (messageId: string) => {
    // Simple confirm for MVP
    if (
      confirm(
        "Â¿Deseas eliminar este mensaje para todos? (Cancelar para eliminar solo para ti)",
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
  // Load Messages when activeChat changes
  useEffect(() => {
    if (!activeChat) return;

    let ignore = false;

    // Direct client query â€” no server round-trip
    const loadMessagesForRoom = async (roomId: string) => {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select(
            `*, profiles:user_id (*), reactions:message_reactions (*)`,
          )
          .eq("room_id", roomId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (!error && data && !ignore) {
          setMessages((data as any).reverse());
        }
      } catch (err) {
        console.error("Error loading messages:", err);
      }
    };

    const loadMembers = async (roomId: string) => {
      try {
        const members = await getRoomMembers(roomId);
        if (members && !ignore) setRoomMembers(members);
      } catch (err) {
        console.error("Error loading members:", err);
      }
    };

    const init = async () => {
      setMessages([]); // Immediately clear old messages
      setInitialLoading(true);
      await Promise.all([
        loadMessagesForRoom(activeChat),
        loadMembers(activeChat)
      ]);
      if (!ignore) {
        markMessagesAsRead(activeChat);
        setInitialLoading(false);
      }
    };

    init();

    // â”€â”€ Realtime subscription (primary) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              `*, profiles:user_id (*)`,
            )
            .eq("id", payload.new.id)
            .single();

          if (data && data.room_id === activeChat) {
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

    // â”€â”€ Polling fallback (30 s) â€” keeps messages current if WS stales â”€â”€â”€â”€â”€â”€â”€â”€
    const pollInterval = setInterval(() => {
      loadMessagesForRoom(activeChat);
    }, 30_000);

    // â”€â”€ Page Visibility API â€” re-fetch when user returns to the tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadMessagesForRoom(activeChat);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // â”€â”€ Window focus â€” re-fetch when window regains focus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handleFocus = () => loadMessagesForRoom(activeChat);
    window.addEventListener("focus", handleFocus);

    return () => {
      ignore = true;
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
      setAddToast({ message: "Error al enviar mensaje", type: "error" });
    }
  };

  const handleStartChat = async (friendId: string) => {
    try {
      // Check locally if room exists â€” null-safe participants check
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
          setAddToast({ message: "Error al iniciar chat", type: "error" });
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
    if (confirm("Â¿EstÃ¡s seguro de que quieres salir del grupo?")) {
      try {
        await leaveGroup(activeChat);
        setActiveChat(null);
        setMobileShowChat(false);
        const updatedRooms = await getUserRooms();
        setRooms(updatedRooms || []);
        setAddToast({ message: "Has salido del grupo", type: "info" });
      } catch (e) {
        console.error(e);
        setAddToast({ message: "Error al salir del grupo", type: "error" });
      }
    }
  };

  const getRoomInfo = (room: ChatRoom) => {
    if (room.type === "group") {
      return {
        name: room.name || "Grupo sin nombre",
        avatar_url: room.avatar_url || null,
        status: null,
      };
    }

    // null-safe: participants may be empty after normalization
    const participants = Array.isArray(room.participants)
      ? room.participants
      : [];
    const otherId = participants.find((id) => id !== currentUserId);

    // Prioritize participants_profiles if available (populated by getUserRooms)
    const profile = room.participants_profiles?.find((p) => p.id === otherId);

    // Fallback to friends list
    const friend = friends.find((f) => f.id === otherId);

    const finalTarget = profile || friend;

    return {
      name:
        finalTarget?.full_name ||
        finalTarget?.username ||
        room.name ||
        "Usuario",
      avatar_url: finalTarget?.avatar_url ?? null,
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
      setAddToast({
        message: "Error al acceder a los dispositivos. Revisa los permisos.",
        type: "error",
      });
    }
  };

  // â”€â”€ File & Media handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      setAddToast({ message: "Error al subir el archivo", type: "error" });
    } finally {
      setUploadingMedia(false);
      setUploadingMediaType(null);
      setPendingFile(null);
    }
  };

  // â”€â”€ Voice recording â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      setAddToast({ message: "No se pudo acceder al micrÃ³fono", type: "error" });
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

  // Removed abrupt return to allow AnimatePresence to handle it

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key="chat-page-main"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex h-dvh overflow-hidden relative z-10"
        >
          {/* Sidebar */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className={`${
              mobileShowChat || (showVideo && !isMinimizedCall) ? "hidden" : "flex"
            } ${
              showVideo && !isMinimizedCall ? "md:hidden" : "md:flex"
            } w-full md:w-80 lg:w-[400px] flex-shrink-0 border-r border-white/6 flex-col bg-surface-2/40 backdrop-blur-xl relative z-10 transition-all duration-300`}
          >
              {/* Sidebar Header */}
            <div
              className="px-4 pb-3 border-b border-white/6 bg-surface-2/40 backdrop-blur-xl"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}
            >
                <div className="flex items-center justify-between mb-3">
                  {/* Back button â€” top-left, universal */}
                  <button
                    onClick={() => router.push("/dashboard")}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-surface-2 border border-white/6 text-gray-400 hover:text-white hover:border-brand-gold/40 transition-all shrink-0"
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
                <div className="flex p-1 bg-surface-2 rounded-xl">
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
                      className="w-full pl-10 pr-4 py-2 bg-surface-2/50 border border-white/6 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold/50 transition-all"
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
                      className="w-full pl-10 pr-4 py-2 bg-surface-2/50 border border-white/6 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-brand-gold/50 transition-all"
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
                        className="p-3 bg-surface-2/40 rounded-xl mx-2 mb-2 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-full bg-surface-2 shrink-0 flex items-center justify-center overflow-hidden">
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
                              className="px-3 py-1 bg-surface-2 text-gray-400 text-xs rounded-full cursor-not-allowed border border-white/10"
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
                                : "border-transparent hover:bg-white/5 hover:border-white/6"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-surface-2 border border-white/10 overflow-hidden flex items-center justify-center">
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
                          <div className="w-12 h-12 rounded-full bg-surface-2 overflow-hidden">
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
            </motion.div>

            {/* Main Chat Area */}
            <div
              className={`${
                mobileShowChat ? "flex" : "hidden"
              } md:flex flex-1 flex-col bg-transparent relative`}
            >
              {activeChat ? (
                <>
                  <AnimatePresence>
                    {showVideo && (
                      <motion.div
                        drag={isMinimizedCall}
                        dragMomentum={false}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={
                          isMinimizedCall
                            ? {
                                position: "absolute",
                                right: 16,
                                top: 80,
                                width: 280, // slightly smaller for pip
                                height: 420,
                                zIndex: 100, // very high
                                borderRadius: 16,
                                opacity: 1,
                                scale: 1,
                              }
                            : {
                                position: "absolute",
                                inset: 0,
                                zIndex: 50,
                                borderRadius: 0,
                                opacity: 1,
                                scale: 1,
                              }
                        }
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-brand-black shadow-2xl overflow-hidden flex flex-col border border-brand-gold/30"
                      >
                        <div className="absolute top-4 left-4 right-4 z-50 flex gap-2 justify-between items-center pointer-events-none">
                          <button
                            onClick={(e) => { e.stopPropagation(); setIsMinimizedCall(!isMinimizedCall); }}
                            className="p-2 bg-black/50 hover:bg-black/80 border border-white/10 rounded-full text-white backdrop-blur-md transition-all shadow-lg pointer-events-auto"
                            title={isMinimizedCall ? "Maximizar Llamada" : "Minimizar a PIP"}
                          >
                            {isMinimizedCall ? <Monitor className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          </button>
                        </div>
                        <VideoRoom
                          roomName={`learn-up-${activeChat}`}
                          username={currentProfile?.full_name || "Usuario"}
                          role={currentProfile?.role || "estudiante"}
                          isCreator={isCallCreator}
                          onLeave={async () => {
                            setShowVideo(false);
                            setShowWhiteboard(false);
                            setIsMinimizedCall(false);
                            await sendMessageAction(
                              activeChat,
                              isVideoCall
                                ? "[CALL_ENDED_VIDEO]"
                                : "[CALL_ENDED_VOICE]",
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
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <>
                    {/* Chat Header */}
                    <div
                      className="px-4 pb-3 border-b border-white/6 flex items-center justify-between bg-brand-black/95 backdrop-blur-xl z-20 shrink-0"
                      style={{
                        paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setMobileShowChat(false)}
                          className="md:hidden flex items-center justify-center w-9 h-9 rounded-full bg-surface-2 border border-white/6 text-gray-400 hover:text-white hover:border-brand-gold/40 transition-all shrink-0"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>

                        {(() => {
                          const activeRoom = rooms.find(
                            (r) => r.id === activeChat,
                          );
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
                            const profile =
                              activeRoom.participants_profiles?.find(
                                (p) => p.id === otherId,
                              );
                            // Fallback to friends list
                            const friend = friends.find(
                              (f) => f.id === otherId,
                            );

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
                              <div className="w-10 h-10 rounded-full bg-surface-2 overflow-hidden flex items-center justify-center">
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
                                {activeRoom.type === "private" &&
                                  statusInfo && (
                                    <p className="text-xs text-brand-gold/80 flex items-center gap-1">
                                      {statusInfo}
                                    </p>
                                  )}
                                {activeRoom.type === "group" && (
                                  <p className="text-xs text-gray-400">
                                    {activeRoom.participants.length} miembros â€¢
                                    Toca para info
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
                    <div 
                      className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0b141a] chat-bg-pattern relative"
                    >
                      {/* Pinned Messages Banner */}
                      {messages.some(m => m.is_pinned) && (
                        <div className="sticky top-0 z-10 w-full mb-4 px-2">
                          <div className="bg-[#202c33]/95 backdrop-blur-md border-l-4 border-brand-gold rounded-xl p-2 shadow-lg flex items-center gap-3 w-full cursor-pointer hover:bg-[#202c33] transition-colors"
                               onClick={() => {
                                 const firstPinned = messages.find(m => m.is_pinned);
                                 if (firstPinned) {
                                   document.getElementById(`msg-${firstPinned.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                 }
                               }}>
                            <Pin className="w-4 h-4 text-brand-gold shrink-0" />
                            <div className="flex flex-col overflow-hidden w-full">
                              <span className="text-brand-gold font-bold text-[11px] uppercase tracking-wider">Mensaje Fijado</span>
                              <span className="text-white/90 text-xs truncate">
                                {messages.find(m => m.is_pinned)?.content || "Archivo adjunto"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {messages.map((msg, idx) => {
                        const isMe = msg.user_id === currentUserId;
                        const senderAvatar = msg.profiles?.avatar_url;
                        const senderInitial = (msg.profiles?.full_name || "?")[0].toUpperCase();
                        return (
                          <motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            key={msg.id}
                            id={`msg-${msg.id}`}
                            className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"} group`}
                          >
                            {/* Avatar for incoming messages */}
                            {!isMe && (
                              <div className="w-7 h-7 rounded-full bg-surface-2 border border-white/10 overflow-hidden flex items-center justify-center shrink-0 mb-1">
                                {senderAvatar ? (
                                  <img src={senderAvatar} className="w-full h-full object-cover" alt={senderInitial} />
                                ) : (
                                  <span className="text-[10px] font-bold text-brand-gold">{senderInitial}</span>
                                )}
                              </div>
                            )}
                            <div
                              className={`max-w-[85%] md:max-w-[70%] p-2 pb-5 relative flex flex-col gap-1 ${isMe ? "bg-[#005c4b]/95 backdrop-blur-md text-white rounded-2xl rounded-tr-md border border-[#005c4b] shadow-md" : "bg-[#202c33]/95 backdrop-blur-md text-white rounded-2xl rounded-tl-md border border-white/5 shadow-md"}`}
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
                                    rooms.find((r) => r.id === activeChat)
                                      ?.type === "group" &&
                                    msg.profiles && (
                                      <p className="text-[10px] font-bold text-brand-gold mb-1">
                                        {msg.profiles.full_name}
                                      </p>
                                    )}

                                  {/* Media Rendering Helper */}
                                  {msg.media_type === "poll" ? (
                                    <div className="flex flex-col gap-2 min-w-[200px] sm:min-w-[240px]">
                                      <div className="flex items-center gap-2 font-bold mb-2">
                                        <BarChart2 className="w-5 h-5 text-brand-gold" />
                                        <span>Encuesta: {msg.content}</span>
                                      </div>
                                      {msg.metadata?.options?.map((opt: string, i: number) => {
                                        const votes = msg.metadata?.votes?.[opt] || [];
                                        const hasVoted = votes.includes(currentUserId);
                                        const totalVotes = Object.values(msg.metadata?.votes || {}).flat().length;
                                        const percent = totalVotes > 0 ? Math.round((votes.length / totalVotes) * 100) : 0;
                                        return (
                                          <div key={i} 
                                               className={`relative overflow-hidden rounded-lg p-2 border cursor-pointer transition-all ${hasVoted ? 'border-brand-gold bg-brand-gold/10' : 'border-white/10 hover:bg-white/5 bg-black/20'}`}
                                               onClick={() => {
                                                 // In a real app, this would trigger an update to msg.metadata.votes
                                                 setAddToast({ message: "Votación (Simulación)", type: "info" });
                                               }}>
                                            <div className="absolute top-0 left-0 h-full bg-brand-gold/20" style={{ width: `${percent}%` }} />
                                            <div className="relative flex justify-between items-center text-sm z-10">
                                              <span>{opt}</span>
                                              <span className="opacity-70 text-xs">{percent}% ({votes.length})</span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : msg.content.startsWith("[image]") ? (
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
                                      <div className="flex flex-col gap-1 min-w-[200px]">
                                        <p className="text-[10px] opacity-70 flex items-center gap-1 mb-1 font-medium">
                                          <Mic className="w-3 h-3 text-brand-gold" /> Nota de voz
                                        </p>
                                        <div className="bg-black/20 rounded-full px-2 py-1 backdrop-blur-sm border border-white/10 shadow-inner">
                                          <audio
                                            src={msg.content.replace("[audio]", "")}
                                            controls
                                            className="w-full outline-none sepia-[.3] hue-rotate-[180deg] saturate-[2]"
                                            style={{ height: 32 }}
                                          />
                                        </div>
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
                                      <span>ðŸ“„</span>
                                      {msg.content.match(
                                        /^\[file:([^\]]+)\]/,
                                      )?.[1] || "Archivo"}
                                    </a>
                                  ) : msg.content.includes(
                                      "youtube.com/watch",
                                    ) || msg.content.includes("youtu.be/") ? (
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
                                            m.content.startsWith(
                                              "[CALL_ENDED",
                                            ) ||
                                            m.content.startsWith(
                                              "[CALL_REJECTED",
                                            ),
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
                                                isCallActive
                                                  ? ""
                                                  : "text-gray-400"
                                              }
                                            >
                                              {msg.content ===
                                              "[CALL_OFFER_VIDEO]"
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
                                              <div className="mt-2 py-2 bg-surface-2/50 rounded-xl text-gray-400 font-bold text-sm flex justify-center items-center gap-2 border border-white/10">
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

                                  {/* Reactions row */}
                                  {msg.reactions && msg.reactions.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 -mb-2 z-10">
                                      {Object.entries(
                                        msg.reactions.reduce((acc: any, r: any) => {
                                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                          return acc;
                                        }, {})
                                      ).map(([emoji, count]: [string, any]) => {
                                        const haveIReacted = msg.reactions?.some((r: any) => r.emoji === emoji && r.user_id === currentUserId);
                                        return (
                                          <div
                                            key={emoji}
                                            className={`px-1.5 py-0.5 rounded-full text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                                              haveIReacted ? 'bg-brand-gold/20 border border-brand-gold/50' : 'bg-black/30 border border-white/5'
                                            }`}
                                            onClick={async () => {
                                              if (haveIReacted) {
                                                await removeMessageReaction(msg.id, emoji);
                                                // Optimistic update omitted for brevity, will rely on realtime
                                              } else {
                                                await addMessageReaction(msg.id, emoji);
                                              }
                                            }}
                                          >
                                            <span>{emoji}</span>
                                            <span className="opacity-80 text-[10px]">{count}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  <div
                                    className={`text-[10px] mt-auto pt-1 self-end flex items-center justify-end gap-1 ${isMe ? "text-white/70" : "text-gray-400"}`}
                                  >
                                    {msg.is_edited && <span className="italic mr-1">Editado</span>}
                                    {msg.is_pinned && <Pin className="w-3 h-3 text-brand-gold" />}
                                    <span>
                                      {new Date(
                                        msg.created_at,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    {isMe && (() => {
                                      const isReadByAnyone = roomMembers.some(rm => 
                                        rm.user_id !== currentUserId && 
                                        rm.last_read_at && 
                                        new Date(rm.last_read_at) >= new Date(msg.created_at)
                                      );
                                      return (
                                        <CheckCheck className={`w-4 h-4 ml-0.5 ${isReadByAnyone ? "text-[#53bdeb]" : "text-white/50"}`} />
                                      );
                                    })()}
                                  </div>
                                </>
                              )}

                              {(() => {
                                const activeRoom = rooms.find(
                                  (r) => r.id === activeChat,
                                );
                                const isAdmin =
                                  activeRoom?.admins &&
                                  currentUserId &&
                                  activeRoom.admins.includes(currentUserId);
                                if (msg.is_deleted_for_everyone) return null;

                                return (
                                  <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-surface-2 rounded-lg p-1 border border-white/10 shadow-xl z-10">
                                    <div className="relative">
                                      <button
                                        className="p-1 hover:text-brand-gold text-gray-400"
                                        onClick={() => setShowEmojiPickerFor(msg.id === showEmojiPickerFor ? null : msg.id)}
                                      >
                                        <Smile className="w-3 h-3" />
                                      </button>
                                      {/* Emoji Picker Popup */}
                                      <AnimatePresence>
                                        {showEmojiPickerFor === msg.id && (
                                          <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 5 }}
                                            className="absolute bottom-full mb-2 right-0 bg-[#0b141a] border border-white/10 rounded-xl p-2 shadow-2xl flex gap-2 z-50"
                                          >
                                            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                              <button
                                                key={emoji}
                                                className="text-xl hover:scale-125 transition-transform"
                                                onClick={async () => {
                                                  setShowEmojiPickerFor(null);
                                                  await addMessageReaction(msg.id, emoji);
                                                }}
                                              >
                                                {emoji}
                                              </button>
                                            ))}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>

                                    {(isAdmin || isMe) && (
                                      <button
                                        className={`p-1 ${msg.is_pinned ? 'text-brand-gold' : 'text-gray-400 hover:text-white'}`}
                                        onClick={() => pinMessage(msg.id, !msg.is_pinned)}
                                      >
                                        <Pin className="w-3 h-3" />
                                      </button>
                                    )}

                                    {isMe && (
                                      <button
                                        className="p-1 hover:text-brand-gold text-gray-400"
                                        onClick={() => {
                                          setEditingMessageId(msg.id);
                                          setEditContent(msg.content);
                                        }}
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                    )}
                                    {(isMe || isAdmin) && (
                                      <button
                                        className="p-1 hover:text-red-500 text-gray-400"
                                        onClick={() =>
                                          handleDeleteMessage(msg.id)
                                        }
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </motion.div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* â”€â”€ Input Area â”€â”€ */}
                    <div className="p-4 border-t border-white/6 fixed bottom-0 left-0 w-full md:sticky md:bottom-0 md:w-auto z-40 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4">
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

                      {/* â”€â”€ File preview bar â”€â”€ */}
                      {pendingFile && (
                        <div className="flex items-center gap-2 bg-surface-2 px-3 py-2 rounded-xl border border-brand-gold/30 mb-2">
                          {pendingFile.type.startsWith("image/") ? (
                            <img
                              src={URL.createObjectURL(pendingFile)}
                              className="w-10 h-10 rounded-lg object-cover border border-white/10"
                              alt="preview"
                            />
                          ) : pendingFile.type.startsWith("video/") ? (
                            <video
                              src={URL.createObjectURL(pendingFile)}
                              className="w-10 h-10 rounded-lg object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center border border-white/10 text-lg">
                              {pendingFile.type.includes("pdf")
                                ? "ðŸ“„"
                                : pendingFile.type.includes("audio")
                                  ? "ðŸŽµ"
                                  : "ðŸ“Ž"}
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

                      {/* â”€â”€ Voice recording indicator â”€â”€ */}
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

                      {/* â”€â”€ File Upload indicator â”€â”€ */}
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

                      <div className="relative flex items-end gap-2 bg-[#202c33] p-1.5 rounded-full border border-white/10 shadow-lg transition-colors">
                        {/* Paperclip â€” all file types */}
                        <button
                          className="p-3 text-gray-400 hover:text-brand-gold hover:bg-brand-gold/10 rounded-full transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <input
                          id="chat-file-input"
                          name="chat-file"
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                          onChange={handleMediaUpload}
                        />

                        <textarea
                          id="chat-message-input"
                          name="chat-message"
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
                                handleEditMessage(
                                  editingMessageId,
                                  editContent,
                                );
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

                        {/* Mic button â€” hold to record / tap to toggle */}
                        {!editingMessageId && (
                          <button
                            onClick={
                              isRecording ? stopRecording : startRecording
                            }
                            className={`p-3 rounded-full transition-colors ${
                              isRecording
                                ? "bg-red-500/20 text-red-400 animate-pulse"
                                : "text-gray-400 hover:text-brand-gold hover:bg-brand-gold/10"
                            }`}
                            title={
                              isRecording ? "Detener grabaciÃ³n" : "Grabar audio"
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
                          className="p-3.5 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
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
                </>
              ) : (
                <div 
                  className="flex-1 flex flex-col items-center justify-center p-8 text-center chat-grid-bg"
                >
                  <div className="w-24 h-24 bg-brand-blue-glow/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <MessageCircle className="w-12 h-12 text-brand-blue-glow" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Aprendamos Juntos
                  </h2>
                  <p className="text-gray-400 max-w-md">
                    Selecciona una conversaciÃ³n para empezar a chatear.
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
                members={
                  rooms.find((r) => r.id === activeChat)
                    ?.participants_profiles || []
                }
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
        </motion.div>
      </AnimatePresence>
    </>
  );
}



