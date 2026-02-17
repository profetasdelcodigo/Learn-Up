"use client";

import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState } from "react";
import { Track, ConnectionState } from "livekit-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  PenTool,
  X,
} from "lucide-react";
import Whiteboard from "./Whiteboard"; // Assumes Whiteboard component exists
import { motion, AnimatePresence } from "framer-motion";

interface VideoRoomProps {
  roomName: string;
  username: string;
  onLeave: () => void;
  videoEnabled?: boolean; // New prop
}

export default function VideoRoom({
  roomName,
  username,
  onLeave,
  videoEnabled = true, // Default to true
}: VideoRoomProps) {
  const [token, setToken] = useState<string>("");
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          `/api/livekit?room=${roomName}&username=${username}`,
        );
        const data = await resp.json();
        setToken(data.token);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [roomName, username]);

  if (token === "") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-brand-black border border-brand-gold/20 rounded-2xl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold mb-4"></div>
        <p className="text-brand-gold font-mono animate-pulse">
          Establishing Secure Connection...
        </p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={videoEnabled} // Use prop
      audio={true}
      token={token}
      connect={true} // Explicitly connect only when mounted (user clicked call)
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: "100%", backgroundColor: "#0A0A0A" }}
      className="relative rounded-2xl overflow-hidden border-2 border-brand-gold/30 shadow-[0_0_30px_rgba(212,175,55,0.1)]"
      onDisconnected={onLeave}
    >
      <div className="flex flex-col h-full relative">
        {/* Main Video Area */}
        <div className="flex-1 relative bg-black">
          {!videoEnabled ? (
            // Audio Only UI
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-brand-gold to-brand-brown animate-pulse flex items-center justify-center shadow-[0_0_50px_rgba(212,175,55,0.3)]">
                <span className="text-4xl font-bold text-brand-black">
                  {username.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <MyVideoConference />
          )}

          <RoomAudioRenderer />

          {/* Whiteboard Overlay */}
          <AnimatePresence>
            {showWhiteboard && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-40 bg-white/95 backdrop-blur-sm"
              >
                <div className="relative w-full h-full">
                  <button
                    onClick={() => setShowWhiteboard(false)}
                    className="absolute top-4 right-4 z-50 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  {/* Only mount if connected to avoid errors */}
                  <WhiteboardWrapper roomId={roomName} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Custom Controls Container */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="pointer-events-auto">
            <CustomControlBar
              onLeave={onLeave}
              onToggleWhiteboard={() => setShowWhiteboard(!showWhiteboard)}
              isWhiteboardOpen={showWhiteboard}
              videoEnabled={videoEnabled} // Pass prop
            />
          </div>
        </div>
      </div>
    </LiveKitRoom>
  );
}

function MyVideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <GridLayout tracks={tracks} style={{ height: "100%" }}>
      <ParticipantTile style={{ height: "100%", width: "100%" }} />
    </GridLayout>
  );
}

function CustomControlBar({
  onLeave,
  onToggleWhiteboard,
  isWhiteboardOpen,
  videoEnabled = true,
}: {
  onLeave: () => void;
  onToggleWhiteboard: () => void;
  isWhiteboardOpen: boolean;
  videoEnabled?: boolean;
}) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isScreenShare, setIsScreenShare] = useState(false);

  useEffect(() => {
    // If video is disabled by default, ensure cam is off state locally
    if (!videoEnabled) {
      setIsCamOn(false);
    }
  }, [videoEnabled]);

  const toggleMic = async () => {
    if (localParticipant) {
      const definedState = !isMicOn;
      await localParticipant.setMicrophoneEnabled(definedState);
      setIsMicOn(definedState);
    }
  };

  const toggleCam = async () => {
    if (localParticipant && videoEnabled) {
      const definedState = !isCamOn;
      await localParticipant.setCameraEnabled(definedState);
      setIsCamOn(definedState);
    }
  };

  const toggleScreen = async () => {
    if (localParticipant) {
      const definedState = !isScreenShare;
      await localParticipant.setScreenShareEnabled(definedState);
      setIsScreenShare(definedState);
    }
  };

  const handleLeave = () => {
    room?.disconnect();
    onLeave();
  };

  const buttonClass =
    "p-4 rounded-full transition-all duration-300 transform hover:scale-110 shadow-lg border border-white/10 backdrop-blur-md";

  return (
    <div className="flex items-center gap-4 bg-black/60 px-8 py-4 rounded-2xl border border-brand-gold/30 shadow-2xl backdrop-blur-xl">
      {/* Mic */}
      <button
        onClick={toggleMic}
        className={`${buttonClass} ${isMicOn ? "bg-brand-black text-brand-gold hover:bg-brand-gold/10" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"}`}
      >
        {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
      </button>

      {/* Camera - Only show if videoEnabled */}
      {videoEnabled && (
        <button
          onClick={toggleCam}
          className={`${buttonClass} ${isCamOn ? "bg-brand-black text-brand-gold hover:bg-brand-gold/10" : "bg-red-500/20 text-red-500 hover:bg-red-500/30"}`}
        >
          {isCamOn ? (
            <Video className="w-6 h-6" />
          ) : (
            <VideoOff className="w-6 h-6" />
          )}
        </button>
      )}

      {/* Screen Share */}
      <button
        onClick={toggleScreen}
        className={`${buttonClass} ${isScreenShare ? "bg-green-500/20 text-green-500" : "bg-brand-black text-brand-gold hover:bg-brand-gold/10"}`}
      >
        <Monitor className="w-6 h-6" />
      </button>

      {/* Whiteboard Toggle */}
      <button
        onClick={onToggleWhiteboard}
        className={`${buttonClass} ${isWhiteboardOpen ? "bg-brand-gold text-brand-black" : "bg-brand-black text-brand-gold hover:bg-brand-gold/10"}`}
      >
        <PenTool className="w-6 h-6" />
      </button>

      {/* Hangup */}
      <button
        onClick={handleLeave}
        className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all duration-300 transform hover:scale-110 shadow-[0_0_15px_rgba(220,38,38,0.5)] border-2 border-red-500"
      >
        <PhoneOff className="w-6 h-6" />
      </button>
    </div>
  );
}

function WhiteboardWrapper({ roomId }: { roomId: string }) {
  const room = useRoomContext();
  // Safe check if room exists and is connected
  if (!room || room.state !== ConnectionState.Connected) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Conectando a la sala...</p>
      </div>
    );
  }
  return <Whiteboard roomId={roomId} />;
}
