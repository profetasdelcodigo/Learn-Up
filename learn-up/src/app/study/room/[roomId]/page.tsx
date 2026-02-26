"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { Video, Edit3, ArrowLeft, Share2, Loader2 } from "lucide-react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { createClient } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

type MediaFile = {
  id: string;
  file_url: string;
  file_type: "photo" | "video" | "audio" | "document";
  title?: string;
};

export default function StudyRoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"video" | "board" | "split">(
    "split",
  );
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("Estudiante");
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [userMedia, setUserMedia] = useState<MediaFile[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [sharedMedia, setSharedMedia] = useState<{
    url: string;
    type: string;
    title?: string;
  } | null>(null);
  const supabase = createClient();

  // Load user media
  const loadUserMedia = async () => {
    setLoadingMedia(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_media")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setUserMedia(data as MediaFile[]);
    }
    setLoadingMedia(false);
  };

  // Setup Realtime Sync
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase.channel(`room_${roomId}`);
    channel
      .on("broadcast", { event: "share-media" }, (payload) => {
        setSharedMedia(payload.payload);
      })
      .on("broadcast", { event: "stop-media" }, () => {
        setSharedMedia(null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, supabase]);

  const broadcastMedia = (media: MediaFile) => {
    const payload = {
      url: media.file_url,
      type: media.file_type,
      title: media.title,
    };
    setSharedMedia(payload); // local update
    supabase.channel(`room_${roomId}`).send({
      type: "broadcast",
      event: "share-media",
      payload: payload,
    });
    setShowMediaModal(false);
  };

  const stopBroadcast = () => {
    setSharedMedia(null);
    supabase.channel(`room_${roomId}`).send({
      type: "broadcast",
      event: "stop-media",
    });
  };

  // Fetch User & Token
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let name = "Estudiante";

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        if (profile?.full_name) {
          name = profile.full_name;
        }
      }
      setUsername(name);

      try {
        const resp = await fetch(
          `/api/livekit?room=${roomId}&username=${encodeURIComponent(name)}`,
        );
        const data = await resp.json();
        if (data.token) {
          setToken(data.token);
        }
      } catch (e) {
        console.error("Error fetching token:", e);
      }
    };

    if (roomId) {
      init();
    }
  }, [roomId]);

  if (!roomId) return null;

  if (!token) {
    return (
      <div className="h-screen w-screen bg-brand-black flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-brand-gold mb-4" />
        <p className="text-gray-400">Preparando sala de estudio...</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: "100vh", backgroundColor: "#0A0A0A" }}
      className="flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex-shrink-0 h-16 bg-brand-black border-b border-brand-gold flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 hover:bg-white/10 rounded-full transition-colors hidden md:block" // Hide back button on mobile to save space if needed, or keep it
          >
            <ArrowLeft className="text-white w-6 h-6" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-white font-bold text-sm md:text-lg">
              Sala: <span className="text-brand-gold">{roomId}</span>
            </h1>
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2 bg-gray-900 rounded-full p-1 border border-gray-700">
          <button
            onClick={() => setActiveTab("video")}
            className={`p-2 rounded-full transition-all ${activeTab === "video" ? "bg-brand-gold text-brand-black" : "text-gray-400 hover:text-white"}`}
            title="Solo Video"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab("split")}
            className={`hidden md:block px-3 py-1 rounded-full text-sm font-medium transition-all ${activeTab === "split" ? "bg-brand-gold text-brand-black" : "text-gray-400 hover:text-white"}`}
            title="Pantalla Dividida"
          >
            Dividida
          </button>
          <button
            onClick={() => setActiveTab("split")} // Improved mobile toggle logic could go here, simply re-using split for now or board
            className={`md:hidden p-2 rounded-full transition-all ${activeTab === "split" ? "bg-brand-gold text-brand-black" : "text-gray-400 hover:text-white"}`}
          >
            {/* Mobile "Split" usually means just switching tabs, but let's keep the button consistent */}
            <div className="flex -space-x-1">
              <div className="w-2 h-4 bg-current border border-black"></div>
              <div className="w-2 h-4 bg-current border border-black"></div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab("board")}
            className={`p-2 rounded-full transition-all ${activeTab === "board" ? "bg-brand-gold text-brand-black" : "text-gray-400 hover:text-white"}`}
            title="Solo Pizarra"
          >
            <Edit3 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* RoomAudioRenderer handles audio playback */}
          <RoomAudioRenderer />
          <button
            onClick={() => {
              loadUserMedia();
              setShowMediaModal(true);
            }}
            className="flex items-center gap-2 px-4 py-1.5 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded-full text-sm font-bold hover:bg-brand-gold hover:text-black transition-all"
          >
            <Share2 className="w-4 h-4" /> Compartir Recuerdo
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Shared Media Overlay */}
        <AnimatePresence>
          {sharedMedia && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute z-40 inset-x-4 top-4 bottom-4 md:inset-x-20 md:top-10 md:bottom-10 bg-black/95 border border-brand-gold/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
                <span className="text-white font-bold flex items-center gap-2">
                  <Share2 className="text-brand-gold w-5 h-5" />
                  Viendo: {sharedMedia.title || "Compartido"}
                </span>
                <button
                  onClick={stopBroadcast}
                  className="px-4 py-1.5 bg-red-500/10 text-red-500 border border-red-500/30 rounded-full text-sm font-bold hover:bg-red-500 hover:text-white transition-all"
                >
                  Cerrar
                </button>
              </div>
              <div className="flex-1 bg-black p-4 flex items-center justify-center overflow-auto">
                {sharedMedia.type === "photo" ? (
                  <img
                    src={sharedMedia.url}
                    className="max-w-full max-h-full object-contain rounded-xl"
                    alt="Compartido"
                  />
                ) : sharedMedia.type === "video" ? (
                  <video
                    src={sharedMedia.url}
                    controls
                    autoPlay
                    className="max-w-full max-h-full rounded-xl"
                  />
                ) : sharedMedia.type === "audio" ? (
                  <audio
                    src={sharedMedia.url}
                    controls
                    autoPlay
                    className="w-full max-w-md"
                  />
                ) : (
                  <iframe
                    src={sharedMedia.url}
                    className="w-full h-full bg-white rounded-xl"
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* LiveKit Video Panel */}
        <div
          className={`transition-all duration-300 relative ${
            activeTab === "video"
              ? "w-full h-full"
              : activeTab === "split"
                ? "h-[40%] md:h-full w-full md:w-1/3 border-b md:border-b-0 md:border-r border-gray-800"
                : "h-0 md:w-0 overflow-hidden hidden"
          }`}
        >
          <VideoConference />
        </div>

        {/* Tldraw Whiteboard Panel */}
        <div
          className={`transition-all duration-300 relative ${
            activeTab === "board"
              ? "w-full h-full"
              : activeTab === "split"
                ? "h-[60%] md:h-full w-full md:w-2/3"
                : "h-0 md:w-0 overflow-hidden hidden"
          }`}
        >
          {/* Tldraw Container */}
          <div className="tldraw__editor w-full h-full bg-white relative">
            <Tldraw persistenceKey={`room-${roomId}`} />
          </div>
        </div>
      </div>

      {/* Media Pick Modal */}
      <AnimatePresence>
        {showMediaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-gray-800 w-full max-w-3xl max-h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-black/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Share2 className="text-brand-gold w-5 h-5" /> Tus Recuerdos
                </h2>
                <button
                  onClick={() => setShowMediaModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {loadingMedia ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
                  </div>
                ) : userMedia.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    No tienes recuerdos guardados en tu Álbum.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {userMedia.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => broadcastMedia(m)}
                        className="bg-black border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-brand-gold transition-colors group"
                      >
                        <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                          {m.file_type === "photo" ? (
                            <img
                              src={m.file_url}
                              className="w-full h-full object-cover"
                              alt={m.title}
                            />
                          ) : m.file_type === "video" ? (
                            <Video className="w-8 h-8 text-blue-400" />
                          ) : (
                            <span className="text-xs text-brand-gold font-bold px-4 text-center line-clamp-2">
                              {m.title}
                            </span>
                          )}
                          <div className="absolute inset-0 bg-brand-gold/0 group-hover:bg-brand-gold/20 transition-all flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 text-white font-bold bg-black/50 px-3 py-1 rounded-full text-xs backdrop-blur-md">
                              Compartir
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LiveKitRoom>
  );
}
