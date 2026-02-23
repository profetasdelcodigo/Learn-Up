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
  useDataChannel,
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
  Youtube,
  Play,
  Ban,
} from "lucide-react";
import Whiteboard from "./Whiteboard"; // Assumes Whiteboard component exists
import { motion, AnimatePresence } from "framer-motion";
import ReactPlayer from "react-player";

const Player = ReactPlayer as any;

interface VideoRoomProps {
  roomName: string;
  username: string;
  onLeave: () => void;
  videoEnabled?: boolean; // New prop
  role?: string;
  isCreator?: boolean;
}

export default function VideoRoom({
  roomName,
  username,
  onLeave,
  videoEnabled = true, // Default to true
  role = "estudiante",
  isCreator = false,
}: VideoRoomProps) {
  const [token, setToken] = useState<string>("");

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
      <VideoRoomInner
        username={username}
        roomName={roomName}
        videoEnabled={videoEnabled}
        onLeave={onLeave}
        role={role}
        isCreator={isCreator}
      />
    </LiveKitRoom>
  );
}

function VideoRoomInner({
  username,
  roomName,
  videoEnabled,
  onLeave,
  role,
  isCreator,
}: {
  username: string;
  roomName: string;
  videoEnabled: boolean;
  onLeave: () => void;
  role: string;
  isCreator: boolean;
}) {
  const [sharedVideoUrl, setSharedVideoUrl] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoInput, setVideoInput] = useState("");
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  const canShareVideo = role === "profesor" || role === "admin" || isCreator;

  const handleRequestPermission = (action: string) => {
    // In a real app, send DataChannel message to admins
    alert(
      `Se envió una solicitud a los profesores y al creador para ${action}.`,
    );
  };

  // Setup Data Channel for syncing video play
  const { send } = useDataChannel("video-share", (msg) => {
    // Data channel msg handler
    try {
      const payload = new TextDecoder().decode(msg.payload);
      const data = JSON.parse(payload);
      if (data.type === "SHARE_VIDEO") {
        setSharedVideoUrl(data.url);
      } else if (data.type === "STOP_VIDEO") {
        setSharedVideoUrl(null);
      }
    } catch (e) {
      console.error("Error decoding data channel msg:", e);
    }
  });

  const handleShareVideo = () => {
    if (!canShareVideo) {
      setIsAlertOpen(true);
      return;
    }
    if (!videoInput) return;

    const payload = JSON.stringify({ type: "SHARE_VIDEO", url: videoInput });
    send(new TextEncoder().encode(payload), { reliable: true });
    setSharedVideoUrl(videoInput);
    setShowVideoModal(false);
    setVideoInput("");
  };

  const handleStopVideo = () => {
    if (!canShareVideo) return;
    const payload = JSON.stringify({ type: "STOP_VIDEO" });
    send(new TextEncoder().encode(payload), { reliable: true });
    setSharedVideoUrl(null);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Main Content Area (Permanent Split View) */}
      <div className="flex-1 flex flex-col md:flex-row relative bg-black overflow-hidden">
        {/* Left Side: Video Participants Grid (Zoom-like gallery) */}
        <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-brand-gold/20 flex flex-col relative z-20 bg-brand-black shadow-2xl shrink-0 h-[40%] md:h-full">
          {!videoEnabled ? (
            // Audio Only Initial UI
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-brand-black">
              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-brand-gold to-brand-brown animate-pulse flex items-center justify-center shadow-[0_0_50px_rgba(212,175,55,0.3)]">
                <span className="text-3xl md:text-4xl font-bold text-brand-black">
                  {username.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          ) : (
            <CustomVideoConference />
          )}
          <RoomAudioRenderer />
        </div>

        {/* Right Side: Presentation Area (Whiteboard or Shared Video) */}
        <div className="flex-1 relative h-[60%] md:h-full w-full bg-white z-10 flex flex-col">
          {sharedVideoUrl ? (
            <div className="w-full h-full relative group bg-black">
              {canShareVideo && (
                <button
                  onClick={handleStopVideo}
                  className="absolute top-4 right-4 z-50 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              {/* @ts-ignore */}
              <Player
                url={sharedVideoUrl as string}
                width="100%"
                height="100%"
                controls={canShareVideo}
                playing={true}
                style={{ position: "absolute", top: 0, left: 0 }}
              />
            </div>
          ) : (
            <div className="relative w-full h-full">
              {/* Overlay blocking interaction if not privileged */}
              {!canShareVideo && (
                <>
                  <div className="absolute top-4 left-4 z-40 bg-brand-black/90 text-brand-gold backdrop-blur-md px-4 py-2 border border-brand-gold/30 rounded-xl shadow-lg text-sm font-medium animate-pulse pointer-events-none">
                    Modo de solo visualización
                  </div>
                  {/* Invisible overlay to catch clicks and trigger permission request */}
                  <div
                    className="absolute inset-0 z-30 cursor-pointer"
                    onClick={() =>
                      handleRequestPermission("interactuar con la pizarra")
                    }
                    title="Haz clic para solicitar permiso"
                  />
                </>
              )}
              <div
                className={
                  canShareVideo
                    ? "pointer-events-auto w-full h-full"
                    : "pointer-events-none w-full h-full"
                }
              >
                <Whiteboard roomId={roomName} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Modal */}
      {showVideoModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-brand-gray border border-brand-gold/50 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Youtube className="w-6 h-6 text-red-500" />
              Compartir Video
            </h3>
            {canShareVideo ? (
              <>
                <input
                  type="text"
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                  placeholder="Pegar link de YouTube o video..."
                  className="w-full bg-brand-black border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-gold mb-4"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowVideoModal(false)}
                    className="px-5 py-2 hover:bg-white/10 text-gray-300 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleShareVideo}
                    className="px-5 py-2 bg-brand-gold text-brand-black font-bold rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" /> Reproducir
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-300 mb-6 font-medium leading-relaxed">
                  Solo los profesores o el creador de la sala pueden poner
                  videos. Si quieres compartir un video, pídele permiso al
                  creador de la llamada enviándole el link por el chat.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setShowVideoModal(false)}
                    className="px-6 py-2.5 bg-brand-gold text-brand-black font-bold rounded-full transition-colors flex items-center gap-2"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Permission Denied Alert */}
      {isAlertOpen && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[70] bg-red-500 text-white font-medium px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl animate-in fade-in slide-in-from-top-10">
          <Ban className="w-5 h-5" />
          No tienes permisos para compartir videos. (Pide permiso al creador)
          <button onClick={() => setIsAlertOpen(false)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Custom Controls Container */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <CustomControlBar
            onLeave={onLeave}
            videoEnabled={videoEnabled} // Pass prop
            onToggleVideoModal={() => setShowVideoModal(true)}
            onRequestPermission={handleRequestPermission}
            isSharedVideoOpen={!!sharedVideoUrl}
            canShareVideo={canShareVideo}
          />
        </div>
      </div>
    </div>
  );
}

function CustomVideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  return (
    <div className="grid grid-cols-2 gap-3 p-3 h-full overflow-y-auto custom-scrollbar content-start bg-brand-black">
      {tracks.map((track) => (
        <ParticipantTile
          key={track.participant.identity + track.source}
          trackRef={track}
          className="aspect-video w-full rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.5)] border-[3px] border-gray-800 transition-all duration-300 data-[lk-speaking=true]:border-brand-gold relative group"
        />
      ))}
    </div>
  );
}

function CustomControlBar({
  onLeave,
  videoEnabled = true,
  onToggleVideoModal,
  onRequestPermission,
  isSharedVideoOpen,
  canShareVideo,
}: {
  onLeave: () => void;
  videoEnabled?: boolean;
  onToggleVideoModal: () => void;
  onRequestPermission: (action: string) => void;
  isSharedVideoOpen: boolean;
  canShareVideo: boolean;
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
        onClick={
          canShareVideo
            ? toggleScreen
            : () => onRequestPermission("compartir pantalla")
        }
        className={`${buttonClass} ${isScreenShare ? "bg-green-500/20 text-green-500" : "bg-brand-black text-brand-gold hover:bg-brand-gold/10"}`}
      >
        <Monitor className="w-6 h-6" />
      </button>

      {/* YouTube Share Toggle */}
      <button
        onClick={
          canShareVideo
            ? onToggleVideoModal
            : () => onRequestPermission("compartir video")
        }
        className={`${buttonClass} ${isSharedVideoOpen ? "bg-red-500/20 text-red-500" : "bg-brand-black text-brand-gold hover:bg-brand-gold/10"}`}
      >
        <Youtube className="w-6 h-6" />
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
