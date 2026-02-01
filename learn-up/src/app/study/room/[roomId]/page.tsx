"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { Video, Edit3, ArrowLeft, Mic, Share2 } from "lucide-react";

export default function StudyRoomPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"video" | "board" | "split">(
    "split",
  );

  if (!roomId) return null;

  return (
    <div className="h-screen w-screen bg-brand-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 h-16 bg-brand-black border-b border-brand-gold flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="text-white w-6 h-6" />
          </button>
          <h1 className="text-white font-bold text-lg hidden md:block">
            Sala de Estudio: <span className="text-brand-gold">{roomId}</span>
          </h1>
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
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${activeTab === "split" ? "bg-brand-gold text-brand-black" : "text-gray-400 hover:text-white"}`}
            title="Pantalla Dividida"
          >
            Dividida
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
          <button className="flex items-center gap-2 px-3 py-1.5 bg-brand-gold/10 text-brand-gold border border-brand-gold rounded-full text-sm hover:bg-brand-gold/20">
            <Share2 className="w-4 h-4" />
            <span className="hidden md:inline">Invitar</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Jitsi Meet Video */}
        <div
          className={`transition-all duration-300 ${
            activeTab === "video"
              ? "w-full h-full"
              : activeTab === "split"
                ? "w-1/3 border-r border-gray-800"
                : "w-0 overflow-hidden"
          }`}
        >
          <iframe
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            src={`https://meet.jit.si/${roomId}#config.prejoinPageEnabled=false&interfaceConfig.TOOLBAR_BUTTONS=['microphone','camera','desktop','fullscreen','hangup','chat']`}
            className="w-full h-full border-none bg-gray-900"
          />
        </div>

        {/* Tldraw Whiteboard */}
        <div
          className={`transition-all duration-300 relative ${
            activeTab === "board"
              ? "w-full h-full"
              : activeTab === "split"
                ? "w-2/3"
                : "w-0 overflow-hidden"
          }`}
        >
          {/* Tldraw needs to be client-side only and handled carefully with styles */}
          <div
            className="tldraw__editor w-full h-full"
            style={{ position: "absolute", inset: 0 }}
          >
            <Tldraw persistenceKey={`room-${roomId}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
