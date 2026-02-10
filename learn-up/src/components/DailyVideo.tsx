"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import {
  DailyProvider,
  useCallObject,
  useParticipantIds,
  useVideoTrack,
  useAudioTrack,
  useDailyEvent,
  useLocalSessionId,
} from "@daily-co/daily-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  Users,
  Edit2,
} from "lucide-react";

// --- Video Tile Component ---
function VideoTile({
  sessionId,
  isLocal = false,
}: {
  sessionId: string;
  isLocal?: boolean;
}) {
  const videoTrack = useVideoTrack(sessionId);
  const audioTrack = useAudioTrack(sessionId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoTrack?.persistentTrack && videoRef.current) {
      videoRef.current.srcObject = new MediaStream([
        videoTrack.persistentTrack,
      ]);
    }
  }, [videoTrack?.persistentTrack]);

  useEffect(() => {
    if (audioTrack?.persistentTrack && audioRef.current && !isLocal) {
      audioRef.current.srcObject = new MediaStream([
        audioTrack.persistentTrack,
      ]);
    }
  }, [audioTrack?.persistentTrack, isLocal]);

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden border border-brand-gold/20 shadow-lg">
      {!videoTrack?.off ? (
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${isLocal ? "scale-x-[-1]" : ""}`}
          autoPlay
          muted={isLocal}
          playsInline
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="w-20 h-20 rounded-full bg-brand-gold/20 flex items-center justify-center">
            <Users className="w-8 h-8 text-brand-gold" />
          </div>
        </div>
      )}
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}

      {/* Name tag */}
      <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs border border-white/10">
        {isLocal ? "Tú" : "Participante"} {audioTrack?.off ? "(Muted)" : ""}
      </div>
    </div>
  );
}

// --- Grid Layout Component ---
function CallGrid() {
  const localSessionId = useLocalSessionId();
  const remoteSessionIds = useParticipantIds({ filter: "remote" });
  const allSessionIds = [localSessionId, ...remoteSessionIds].filter(
    Boolean,
  ) as string[];

  // Calculate grid cols based on participant count
  const gridCols =
    allSessionIds.length === 1
      ? "grid-cols-1"
      : allSessionIds.length <= 4
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div className={`grid ${gridCols} gap-4 w-full h-full p-4 auto-rows-fr`}>
      {allSessionIds.map((id) => (
        <VideoTile key={id} sessionId={id} isLocal={id === localSessionId} />
      ))}
    </div>
  );
}

// --- Controls Component ---
function CallControls({
  onLeave,
  isMinimized,
  onToggleMinimize,
  onToggleWhiteboard,
  isWhiteboardOpen,
  startWithVideo = true,
}: {
  onLeave: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onToggleWhiteboard?: () => void;
  isWhiteboardOpen?: boolean;
  startWithVideo?: boolean;
}) {
  // @ts-ignore
  const callObject = useCallObject();
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(startWithVideo);

  // Sync state with daily
  useDailyEvent("participant-updated", (evt: any) => {
    if (evt.participant.local) {
      setIsMicOn(evt.participant.audio);
      setIsCamOn(evt.participant.video);
    }
  });

  const toggleMic = useCallback(() => {
    callObject?.setLocalAudio(!isMicOn);
  }, [callObject, isMicOn]);

  const toggleCam = useCallback(() => {
    callObject?.setLocalVideo(!isCamOn);
  }, [callObject, isCamOn]);

  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-brand-gold/30 shadow-2xl z-50 pointer-events-auto"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <button
        onClick={toggleMic}
        className={`p-3 rounded-full transition-all ${isMicOn ? "bg-gray-700/50 hover:bg-gray-600/50 text-white" : "bg-red-500/20 text-red-500 border border-red-500/50"}`}
      >
        {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      <button
        onClick={toggleCam}
        className={`p-3 rounded-full transition-all ${isCamOn ? "bg-gray-700/50 hover:bg-gray-600/50 text-white" : "bg-red-500/20 text-red-500 border border-red-500/50"}`}
      >
        {isCamOn ? (
          <Video className="w-5 h-5" />
        ) : (
          <VideoOff className="w-5 h-5" />
        )}
      </button>

      {/* Whiteboard Toggle (Only if handler provided) */}
      {onToggleWhiteboard && (
        <button
          onClick={onToggleWhiteboard}
          className={`p-3 rounded-full transition-all ${isWhiteboardOpen ? "bg-brand-gold text-brand-black" : "bg-gray-700/50 hover:bg-gray-600/50 text-white"}`}
          title="Pizarra Compartida"
        >
          <Edit2 className="w-5 h-5" />
        </button>
      )}

      <div className="w-px h-8 bg-gray-700 mx-2" />

      <button
        onClick={onToggleMinimize}
        className="p-3 rounded-full bg-gray-700/50 hover:bg-gray-600/50 text-white transition-all"
      >
        {isMinimized ? (
          <Maximize2 className="w-5 h-5" />
        ) : (
          <Minimize2 className="w-5 h-5" />
        )}
      </button>

      <button
        onClick={onLeave}
        className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all shadow-lg shadow-red-600/30"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

// --- Main Wrapper ---
export default function DailyVideo({
  roomUrl,
  onLeave,
  onToggleWhiteboard,
  isWhiteboardOpen,
  startWithVideo = true,
}: {
  roomUrl: string;
  onLeave: () => void;
  onToggleWhiteboard?: () => void;
  isWhiteboardOpen?: boolean;
  startWithVideo?: boolean;
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);

  useEffect(() => {
    // 1. Singleton Check
    let instance = DailyIframe.getCallInstance();
    if (!instance) {
      instance = DailyIframe.createCallObject({
        url: roomUrl,
        audioSource: true,
        videoSource: startWithVideo,
      });
    }

    setCallObject(instance);

    // 2. Join Logic
    const joinCall = async () => {
      if (!instance) return;
      const state = instance.meetingState();

      // Only join if we are not already in a meeting or joining one
      if (
        state !== "joined-meeting" &&
        state !== "joining-meeting" &&
        !state.includes("error")
      ) {
        try {
          await instance.join({ url: roomUrl });
        } catch (e) {
          console.error("Error joining call:", e);
        }
      }
    };

    joinCall();

    // 3. Cleanup
    return () => {
      try {
        instance?.leave();
        instance?.destroy();
      } catch (e) {
        console.error("Error destroying call object:", e);
      }
    };
  }, [roomUrl]); // Only re-run if roomUrl changes

  if (!callObject) return null;

  return (
    <DailyProvider callObject={callObject}>
      <AnimatePresence>
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{
            opacity: 1,
            scale: 1,
            width: isMinimized ? "320px" : "100%",
            height: isMinimized ? "180px" : "100%",
            borderRadius: isMinimized ? "1rem" : "0",
          }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`
             fixed z-50 bg-black border border-brand-gold/30 shadow-2xl overflow-hidden pointer-events-none
             ${isMinimized ? "bottom-24 right-6 border-brand-gold" : "inset-0 md:static md:w-full md:h-full"}
           `}
          style={{
            // If minimized, use fixed positioning. If maximized, depending on use case, usage absolute or fixed.
            // But user says: "overlay ... sobre el chat" but also allows Tldraw simultaneously.
            // If Max: covers everything? Or behaves like a pane?
            // "pantalla completa sobre el chat... Picture-in-Picture"
            position: isMinimized ? "fixed" : "absolute",
            top: isMinimized ? "auto" : 0,
            left: isMinimized ? "auto" : 0,
          }}
        >
          {/* Controls Wrapper to enable clicks */}
          <div className="relative w-full h-full pointer-events-auto">
            <CallGrid />
            <CallControls
              onLeave={() => {
                callObject.leave();
                onLeave();
              }}
              isMinimized={isMinimized}
              onToggleMinimize={() => setIsMinimized(!isMinimized)}
              onToggleWhiteboard={onToggleWhiteboard}
              isWhiteboardOpen={isWhiteboardOpen}
              startWithVideo={startWithVideo}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </DailyProvider>
  );
}
