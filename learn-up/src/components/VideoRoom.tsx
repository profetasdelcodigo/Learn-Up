"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useRoomContext,
  useLocalParticipant,
  useDataChannel,
  useParticipants,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState } from "react";
import { Track, RemoteParticipant, LocalParticipant } from "livekit-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  X,
  Youtube,
  Play,
  Ban,
} from "lucide-react";
import Whiteboard from "./Whiteboard";
import ReactPlayer from "react-player";

const Player = ReactPlayer as any;

interface VideoRoomProps {
  roomName: string;
  username: string;
  onLeave: () => void;
  videoEnabled?: boolean;
  role?: string;
  isCreator?: boolean;
}

export default function VideoRoom({
  roomName,
  username,
  onLeave,
  videoEnabled = true,
  role = "estudiante",
  isCreator = false,
}: VideoRoomProps) {
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(
          `/api/livekit?room=${roomName}&username=${encodeURIComponent(username)}`,
        );
        const data = await resp.json();
        setToken(data.token);
      } catch (e) {
        console.error("Error fetching LiveKit token:", e);
      }
    })();
  }, [roomName, username]);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-brand-black border border-brand-gold/20 rounded-2xl gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold"></div>
        <p className="text-brand-gold font-mono animate-pulse text-sm">
          Estableciendo conexión segura...
        </p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={videoEnabled}
      audio={true}
      token={token}
      connect={true}
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

// ─── Participant Tile with mic/cam status ────────────────────────────────────
function ParticipantCard({
  participant,
}: {
  participant: RemoteParticipant | LocalParticipant;
}) {
  const cameraTrack = participant
    .getTrackPublications()
    .find((t) => t.source === Track.Source.Camera && t.track && !t.isMuted);

  const isCamOn = !!cameraTrack;
  const isMicOn = !participant.isMicrophoneEnabled
    ? false
    : participant.isMicrophoneEnabled;

  const isSpeaking = (participant as any).isSpeaking ?? false;

  // Get avatar from participant metadata if available
  const meta = participant.metadata
    ? (() => {
        try {
          return JSON.parse(participant.metadata);
        } catch {
          return {};
        }
      })()
    : {};
  const avatarUrl = meta.avatar_url || null;

  return (
    <div
      className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all duration-200 ${
        isSpeaking
          ? "border-brand-gold shadow-[0_0_16px_rgba(212,175,55,0.7)]"
          : "border-gray-800"
      } bg-brand-black`}
    >
      {isCamOn ? (
        /* LiveKit attaches video to a track — use the attach API */
        <video
          ref={(el) => {
            if (el && cameraTrack?.track) {
              cameraTrack.track.attach(el);
            }
          }}
          autoPlay
          playsInline
          muted={participant instanceof LocalParticipant}
          className="w-full h-full object-cover"
        />
      ) : (
        /* Camera off — show avatar / initials */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-black gap-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={participant.identity}
              className="w-14 h-14 rounded-full object-cover border-2 border-brand-gold/40"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-gold to-brand-brown flex items-center justify-center text-brand-black font-bold text-2xl select-none">
              {participant.identity.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-white text-xs font-medium truncate max-w-[80%] text-center">
            {participant.identity}
          </span>
        </div>
      )}

      {/* Status bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-white text-xs font-medium truncate max-w-[70%]">
          {participant.identity}
          {participant instanceof LocalParticipant && (
            <span className="text-brand-gold ml-1">(Tú)</span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {isMicOn ? (
            <Mic className="w-3 h-3 text-green-400" />
          ) : (
            <MicOff className="w-3 h-3 text-red-400" />
          )}
          {isCamOn ? (
            <Video className="w-3 h-3 text-green-400" />
          ) : (
            <VideoOff className="w-3 h-3 text-red-400" />
          )}
        </div>
      </div>

      {/* Speaking glow ring */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-brand-gold animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

// ─── Participants Grid (2 columns, scrollable) ───────────────────────────────
function CustomVideoConference() {
  const participants = useParticipants();

  if (participants.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Esperando participantes...
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-2 p-3 h-full overflow-y-auto content-start scroll-smooth"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(212,175,55,0.3) transparent",
      }}
    >
      {participants.map((participant) => (
        <ParticipantCard key={participant.identity} participant={participant} />
      ))}
    </div>
  );
}

// ─── Inner Room Component ────────────────────────────────────────────────────
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
  const [permissionToast, setPermissionToast] = useState<string | null>(null);

  const canShare = role === "profesor" || role === "admin" || isCreator;

  const handleRequestPermission = (action: string) => {
    setPermissionToast(
      `Se envió la solicitud a los profesores y al creador para: ${action}.`,
    );
    setTimeout(() => setPermissionToast(null), 4000);
  };

  // DataChannel for cross-participant video sync
  const { send } = useDataChannel("video-share", (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.type === "SHARE_VIDEO") setSharedVideoUrl(data.url);
      else if (data.type === "STOP_VIDEO") setSharedVideoUrl(null);
    } catch (e) {
      console.error("DataChannel decode error:", e);
    }
  });

  const handleShareVideo = () => {
    if (!videoInput.trim()) return;
    send(
      new TextEncoder().encode(
        JSON.stringify({ type: "SHARE_VIDEO", url: videoInput }),
      ),
      {
        reliable: true,
      },
    );
    setSharedVideoUrl(videoInput);
    setShowVideoModal(false);
    setVideoInput("");
  };

  const handleStopVideo = () => {
    send(new TextEncoder().encode(JSON.stringify({ type: "STOP_VIDEO" })), {
      reliable: true,
    });
    setSharedVideoUrl(null);
  };

  return (
    <div className="flex flex-col h-full relative bg-brand-black">
      {/* Permission toast */}
      {permissionToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[70] bg-brand-gold text-brand-black font-semibold px-5 py-3 rounded-full shadow-2xl text-sm animate-bounce">
          {permissionToast}
        </div>
      )}

      {/* Main split layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT: Participants (2-col scrollable grid) */}
        <div className="w-full md:w-80 lg:w-96 shrink-0 h-[45%] md:h-full border-b md:border-b-0 md:border-r border-brand-gold/20 bg-zinc-950 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-brand-gold/10">
            <span className="text-brand-gold text-xs font-bold uppercase tracking-wider">
              Participantes
            </span>
          </div>

          {videoEnabled ? (
            <CustomVideoConference />
          ) : (
            /* Audio-only: show avatar pulsing */
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-gold to-brand-brown animate-pulse flex items-center justify-center shadow-[0_0_50px_rgba(212,175,55,0.3)]">
                <span className="text-4xl font-bold text-brand-black">
                  {username.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-brand-gold text-sm font-medium">
                {username}
              </span>
              <span className="text-gray-500 text-xs">
                Llamada de voz activa
              </span>
            </div>
          )}
          <RoomAudioRenderer />
        </div>

        {/* RIGHT: Presentation area (Whiteboard / Screen / Video) */}
        <div className="flex-1 h-[55%] md:h-full relative bg-white">
          {sharedVideoUrl ? (
            <div className="w-full h-full relative group bg-black">
              {canShare && (
                <button
                  onClick={handleStopVideo}
                  className="absolute top-4 right-4 z-50 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {/* @ts-ignore */}
              <Player
                url={sharedVideoUrl}
                width="100%"
                height="100%"
                controls={canShare}
                playing={true}
                style={{ position: "absolute", top: 0, left: 0 }}
              />
            </div>
          ) : (
            <div className="relative w-full h-full">
              {/* View-only badge + click interceptor for students */}
              {!canShare && (
                <>
                  <div className="absolute top-3 left-3 z-40 bg-brand-black/90 text-brand-gold text-xs font-bold px-3 py-1.5 rounded-full border border-brand-gold/30 animate-pulse pointer-events-none">
                    Solo visualización — Haz clic para solicitar permiso
                  </div>
                  <div
                    className="absolute inset-0 z-30 cursor-pointer"
                    onClick={() =>
                      handleRequestPermission("interactuar con la pizarra")
                    }
                  />
                </>
              )}
              <div
                className={
                  canShare
                    ? "w-full h-full"
                    : "w-full h-full pointer-events-none"
                }
              >
                <Whiteboard roomId={roomName} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Share Modal */}
      {showVideoModal && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-brand-gray border border-brand-gold/50 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Youtube className="w-6 h-6 text-red-500" /> Compartir Video
            </h3>
            {canShare ? (
              <>
                <input
                  type="text"
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleShareVideo()}
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
                    className="px-5 py-2 bg-brand-gold text-brand-black font-bold rounded-xl flex items-center gap-2"
                  >
                    <Play className="w-4 h-4" /> Reproducir
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <Ban className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-gray-300 mb-4 text-sm leading-relaxed">
                  Solo los profesores o el creador pueden compartir videos.
                  Pídeles permiso.
                </p>
                <button
                  onClick={() => {
                    setShowVideoModal(false);
                    handleRequestPermission("compartir video");
                  }}
                  className="px-6 py-2.5 bg-brand-gold text-brand-black font-bold rounded-full"
                >
                  Enviar Solicitud
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-5 left-0 right-0 flex justify-center z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <CustomControlBar
            onLeave={onLeave}
            videoEnabled={videoEnabled}
            onToggleVideoModal={() => setShowVideoModal(true)}
            onRequestPermission={handleRequestPermission}
            isSharedVideoOpen={!!sharedVideoUrl}
            canShare={canShare}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Control Bar ─────────────────────────────────────────────────────────────
function CustomControlBar({
  onLeave,
  videoEnabled = true,
  onToggleVideoModal,
  onRequestPermission,
  isSharedVideoOpen,
  canShare,
}: {
  onLeave: () => void;
  videoEnabled?: boolean;
  onToggleVideoModal: () => void;
  onRequestPermission: (action: string) => void;
  isSharedVideoOpen: boolean;
  canShare: boolean;
}) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(videoEnabled);
  const [isScreenShare, setIsScreenShare] = useState(false);

  const toggleMic = async () => {
    if (!localParticipant) return;
    const next = !isMicOn;
    await localParticipant.setMicrophoneEnabled(next);
    setIsMicOn(next);
  };

  const toggleCam = async () => {
    if (!localParticipant || !videoEnabled) return;
    const next = !isCamOn;
    await localParticipant.setCameraEnabled(next);
    setIsCamOn(next);
  };

  const toggleScreen = async () => {
    if (!localParticipant) return;
    const next = !isScreenShare;
    await localParticipant.setScreenShareEnabled(next);
    setIsScreenShare(next);
  };

  const handleLeave = () => {
    room?.disconnect();
    onLeave();
  };

  const btn =
    "p-3.5 rounded-full transition-all duration-200 hover:scale-110 shadow-lg border border-white/10 backdrop-blur-md flex items-center justify-center";

  return (
    <div className="flex items-center gap-3 bg-black/70 px-6 py-3.5 rounded-2xl border border-brand-gold/30 shadow-2xl backdrop-blur-xl">
      {/* Mic */}
      <button
        onClick={toggleMic}
        title={isMicOn ? "Silenciar" : "Activar micrófono"}
        className={`${btn} ${isMicOn ? "bg-zinc-900 text-brand-gold" : "bg-red-500/20 text-red-400"}`}
      >
        {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      {/* Cam */}
      {videoEnabled && (
        <button
          onClick={toggleCam}
          title={isCamOn ? "Apagar cámara" : "Activar cámara"}
          className={`${btn} ${isCamOn ? "bg-zinc-900 text-brand-gold" : "bg-red-500/20 text-red-400"}`}
        >
          {isCamOn ? (
            <Video className="w-5 h-5" />
          ) : (
            <VideoOff className="w-5 h-5" />
          )}
        </button>
      )}

      {/* Screen Share */}
      <button
        onClick={
          canShare
            ? toggleScreen
            : () => onRequestPermission("compartir pantalla")
        }
        title="Compartir pantalla"
        className={`${btn} ${isScreenShare ? "bg-green-500/20 text-green-400" : "bg-zinc-900 text-brand-gold"}`}
      >
        <Monitor className="w-5 h-5" />
      </button>

      {/* Video Share */}
      <button
        onClick={
          canShare
            ? onToggleVideoModal
            : () => onRequestPermission("compartir video")
        }
        title="Compartir video"
        className={`${btn} ${isSharedVideoOpen ? "bg-red-500/20 text-red-400" : "bg-zinc-900 text-brand-gold"}`}
      >
        <Youtube className="w-5 h-5" />
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-white/10 mx-1" />

      {/* Hangup */}
      <button
        onClick={handleLeave}
        title="Colgar"
        className="p-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all hover:scale-110 shadow-[0_0_15px_rgba(220,38,38,0.5)] border-2 border-red-500"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}
