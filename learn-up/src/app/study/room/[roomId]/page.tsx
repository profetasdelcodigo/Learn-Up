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

export default function StudyRoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"video" | "board" | "split">(
    "split",
  );
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("Estudiante");

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
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
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
    </LiveKitRoom>
  );
}
