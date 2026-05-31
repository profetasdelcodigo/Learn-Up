"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
  useDataChannel,
  useParticipants,
  useTracks,
  VideoTrack,
  ParticipantContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  Track,
  RemoteParticipant,
  LocalParticipant,
} from "livekit-client";
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
  MessageCircle,
  Hand,
  Settings,
  Maximize2,
  Users,
  Pin,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactPlayer from "react-player";

const Player = ReactPlayer as any;

// --- Props ---
interface VideoRoomProps {
  roomName: string;
  username: string;
  onLeave: () => void;
  videoEnabled?: boolean;
  role?: string;
  isCreator?: boolean;
}

type ParticipantMetadata = {
  userId?: string;
  displayName?: string;
  name?: string;
  username?: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

function getParticipantMetadata(
  participant: RemoteParticipant | LocalParticipant,
): ParticipantMetadata {
  try {
    return JSON.parse(participant.metadata || "{}");
  } catch {
    return {};
  }
}

function getParticipantDisplayName(
  participant: RemoteParticipant | LocalParticipant,
) {
  const metadata = getParticipantMetadata(participant);
  return (
    metadata.displayName ||
    metadata.name ||
    (participant as any).name ||
    metadata.username ||
    "Usuario"
  );
}

// --- Root Component ---
export default function VideoRoom({
  roomName,
  username,
  onLeave,
  videoEnabled = true,
  role = "estudiante",
  isCreator = false,
}: VideoRoomProps) {
  const [token, setToken] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const resp = await fetch(`/api/livekit?room=${encodeURIComponent(roomName)}`);
        const data = await resp.json();
        if (!resp.ok || !data.token) {
          setError(data.error || "No se pudo entrar a la sala.");
          return;
        }
        setToken(data.token);
      } catch (e) {
        console.error("Error fetching LiveKit token:", e);
        setError("No se pudo conectar con LiveKit.");
      }
    })();
  }, [roomName]);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-brand-black border border-white/10 rounded-2xl gap-4 backdrop-blur-xl">
        {!error && (
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-brand-violet shadow-glow-violet" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-brand-violet/20 rounded-full animate-pulse" />
            </div>
          </div>
        )}
        <div className="text-center">
          <p className="text-white font-bold text-lg mb-1">
            Conectando a la sala
          </p>
          <p className="text-gray-500 text-sm animate-pulse">
            Preparando cifrado y medios...
          </p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={false}
      token={token}
      connect={true}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: "100%", backgroundColor: "#0A0A0F" }}
      className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
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

// --- Participant Tile ---
function ParticipantTileCard({
  participant,
  isPinned = false,
  onPin,
  isCreator = false,
}: {
  participant: RemoteParticipant | LocalParticipant;
  isPinned?: boolean;
  onPin?: () => void;
  isCreator?: boolean;
}) {
  const isLocal = participant instanceof LocalParticipant;
  const isMicOn = participant.isMicrophoneEnabled;
  const isCamOn = participant.isCameraEnabled;
  const isSpeaking = (participant as any).isSpeaking ?? false;
  const displayName = getParticipantDisplayName(participant);
  const metadata = getParticipantMetadata(participant);
  const avatarUrl = metadata.avatar_url;

  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }]);
  const myTrack = cameraTracks.find((t) => t.participant.identity === participant.identity);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative group rounded-2xl overflow-hidden bg-white/5 border transition-all duration-300 ${
        isSpeaking
          ? "border-brand-violet ring-2 ring-brand-violet/50 shadow-glow-violet"
          : "border-white/10"
      } ${isPinned ? "h-full w-full" : "aspect-video"}`}
    >
      {/* Background for camera-off state */}
      {!isCamOn && (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-violet/10 via-brand-indigo/10 to-transparent flex flex-col items-center justify-center p-4">
          <div className="relative">
            {isSpeaking && (
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-brand-violet rounded-full blur-xl"
              />
            )}
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-20 h-20 rounded-3xl object-cover border-2 border-white/20 shadow-2xl relative z-10"
              />
            ) : (
              <div className="w-20 h-20 rounded-3xl bg-surface-3 flex items-center justify-center text-brand-violet font-bold text-3xl border-2 border-white/10 relative z-10">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <p className="mt-4 font-bold text-white text-sm">{displayName}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">{metadata.role || 'Estudiante'}</p>
        </div>
      )}

      {/* Camera Feed */}
      {isCamOn && myTrack && (
        <VideoTrack
          trackRef={myTrack as any}
          className="w-full h-full object-cover"
        />
      )}

      {/* Overlay Info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-bold truncate">
              {displayName} {isLocal && "(Tú)"}
            </span>
            {isPinned && <Pin className="w-3 h-3 text-brand-violet" />}
          </div>
          <div className="flex items-center gap-2">
             {!isLocal && (
               <button onClick={onPin} className="p-1.5 bg-white/10 rounded-lg hover:bg-brand-violet transition-colors">
                  <Maximize2 className="w-3 h-3 text-white" />
               </button>
             )}
             <div className={`p-1.5 rounded-lg ${isMicOn ? "bg-white/10" : "bg-red-500/20"}`}>
               {isMicOn ? <Mic className="w-3 h-3 text-white" /> : <MicOff className="w-3 h-3 text-red-400" />}
             </div>
          </div>
        </div>
      </div>

      {/* Mini status indicator (always visible) */}
      <div className="absolute top-3 right-3 flex gap-1">
        {!isMicOn && <div className="p-1.5 bg-red-500/80 rounded-lg backdrop-blur-md"><MicOff className="w-3 h-3 text-white" /></div>}
        {isLocal && isCreator && <div className="p-1.5 bg-brand-violet/80 rounded-lg backdrop-blur-md text-[8px] font-bold text-white uppercase px-2 py-1">PROFE</div>}
      </div>
    </motion.div>
  );
}

// --- Adaptive Grid ---
function ParticipantsAdaptiveGrid({ 
  pinnedParticipant, 
  onPin,
  isCreator = false,
}: { 
  pinnedParticipant: string | null; 
  onPin: (id: string | null) => void;
  isCreator?: boolean;
}) {
  const participants = useParticipants();

  const gridClass = useMemo(() => {
    const count = participants.length;
    if (pinnedParticipant) return "grid-cols-1";
    if (count <= 1) return "flex items-center justify-center h-full";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    return "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  }, [participants.length, pinnedParticipant]);

  if (participants.length === 0) return null;

  const pinned = participants.find(p => p.identity === pinnedParticipant);
  const others = participants.filter(p => p.identity !== pinnedParticipant);

  return (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
      {pinned ? (
        <div className="flex flex-col h-full gap-4">
          <div className="flex-1 min-h-0">
            <ParticipantTileCard 
              participant={pinned} 
              isPinned={true} 
              onPin={() => onPin(null)} 
              isCreator={isCreator && pinned instanceof LocalParticipant}
            />
          </div>
          <div className="h-40 shrink-0 flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {others.map(p => (
              <div key={p.identity} className="w-64 shrink-0">
                <ParticipantTileCard 
                  participant={p} 
                  onPin={() => onPin(p.identity)} 
                  isCreator={isCreator && p instanceof LocalParticipant}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`grid gap-4 ${gridClass}`}>
          {participants.map(p => (
            <ParticipantTileCard 
              key={p.identity} 
              participant={p} 
              onPin={() => onPin(p.identity)} 
              isCreator={isCreator && p instanceof LocalParticipant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Inner Room ---
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
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  
  // Presentation State
  const [presentationMode, setPresentationMode] = useState<"grid" | "whiteboard" | "video" | "screenshare">("grid");
  const [sharedVideoUrl, setSharedVideoUrl] = useState<string | null>(null);

  const canShare = role === "profesor" || role === "admin" || isCreator;

  const { send } = useDataChannel("presentation", (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.type === "HAND_RAISE") {
        // Handle hand raise alert for host
        console.log("Hand raised by:", data.from);
      } else if (data.type === "CALL_ENDED") {
        onLeave();
      }
    } catch {}
  });

  const toggleHand = () => {
    setHandRaised(!handRaised);
    send(new TextEncoder().encode(JSON.stringify({ type: "HAND_RAISE", from: username, value: !handRaised })), { reliable: true });
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-violet rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-indigo rounded-full blur-[120px]" />
      </div>

      {/* Header Info */}
      <div className="px-6 py-4 flex items-center justify-between relative z-10 backdrop-blur-md bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-violet/20 flex items-center justify-center border border-brand-violet/30">
            <Users className="w-5 h-5 text-brand-violet" />
          </div>
          <div>
            <h1 className="font-bold text-white leading-none">Aprendamos Juntos</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">SALA: {roomName.replace('learn-up-', '')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <div className="px-3 py-1.5 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-white">REC • 00:00</span>
           </div>
           <button onClick={() => setShowChat(!showChat)} className={`p-2 rounded-xl transition-all ${showChat ? 'bg-brand-violet text-white shadow-glow-violet' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              <MessageCircle className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        <div className="flex-1 flex flex-col min-w-0">
          <ParticipantsAdaptiveGrid 
            pinnedParticipant={pinnedParticipant} 
            onPin={setPinnedParticipant} 
            isCreator={isCreator}
          />
        </div>

        {/* Floating Side Chat */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-80 border-l border-white/10 bg-black/40 backdrop-blur-2xl flex flex-col"
            >
               <div className="p-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-bold text-white">Chat de la sala</h3>
                  <button onClick={() => setShowChat(false)}><X className="w-4 h-4 text-gray-500" /></button>
               </div>
               <div className="flex-1 p-4 flex flex-col items-center justify-center text-center text-gray-500 gap-3">
                  <MessageCircle className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Envía un mensaje a todos en la sala.</p>
                  {/* Simplified chat would go here */}
               </div>
               <div className="p-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Escribe algo..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-brand-violet" />
                    <button className="p-2 bg-brand-violet text-white rounded-xl"><Play className="w-4 h-4" /></button>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Toolbar */}
      <div className="absolute bottom-8 left-0 w-full flex justify-center z-50 px-4 pointer-events-none">
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 flex items-center gap-1 shadow-2xl pointer-events-auto"
        >
          <ControlItem 
             icon={<Mic className="w-5 h-5" />} 
             offIcon={<MicOff className="w-5 h-5" />}
             active={true}
             toggle={() => {}}
             label="Mic"
          />
          <ControlItem 
             icon={<Video className="w-5 h-5" />} 
             offIcon={<VideoOff className="w-5 h-5" />}
             active={videoEnabled}
             toggle={() => {}}
             label="Cámara"
          />
          <div className="w-px h-8 bg-white/10 mx-1" />
          <ControlItem 
             icon={<Monitor className="w-5 h-5" />} 
             active={false}
             toggle={() => {}}
             label="Pantalla"
          />
          <ControlItem 
             icon={<Hand className={`w-5 h-5 ${handRaised ? 'text-yellow-400' : ''}`} />} 
             active={handRaised}
             toggle={toggleHand}
             label="Levantar"
          />
          <ControlItem 
             icon={<Settings className="w-5 h-5" />} 
             active={false}
             toggle={() => {}}
             label="Opciones"
          />
          <div className="w-px h-8 bg-white/10 mx-1" />
          <button
            onClick={() => {
              if (canShare) send(new TextEncoder().encode(JSON.stringify({ type: "CALL_ENDED" })), { reliable: true });
              onLeave();
            }}
            className="group flex flex-col items-center gap-1 p-3 bg-red-500 hover:bg-red-600 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/25"
          >
            <PhoneOff className="w-5 h-5 text-white" />
            <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Colgar</span>
          </button>
        </motion.div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

function ControlItem({ 
  icon, 
  offIcon, 
  active, 
  toggle, 
  label 
}: { 
  icon: React.ReactNode, 
  offIcon?: React.ReactNode, 
  active: boolean, 
  toggle: () => void, 
  label: string 
}) {
  return (
    <button
      onClick={toggle}
      className={`group flex flex-col items-center gap-1 p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 ${
        active 
          ? "bg-white/5 text-white hover:bg-white/10" 
          : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
      }`}
    >
      {active ? icon : (offIcon || icon)}
      <span className={`text-[8px] font-bold uppercase tracking-tighter ${active ? 'text-gray-400' : 'text-red-400'}`}>{label}</span>
    </button>
  );
}
