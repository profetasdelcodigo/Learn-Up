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
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Track,
  RemoteParticipant,
  LocalParticipant,
  TrackPublication,
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
  PenLine,
  Eraser,
} from "lucide-react";
import ReactPlayer from "react-player";

const Player = ReactPlayer as any;

// ─── Props ───────────────────────────────────────────────────────────────────
interface VideoRoomProps {
  roomName: string;
  username: string;
  onLeave: () => void;
  videoEnabled?: boolean;
  role?: string;
  isCreator?: boolean;
}

// ─── Root Component ──────────────────────────────────────────────────────────
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
          `/api/livekit?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`,
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-gold" />
        <p className="text-brand-gold font-mono animate-pulse text-sm">
          Estableciendo conexión segura...
        </p>
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

// ─── Participant Tile ─────────────────────────────────────────────────────────
function ParticipantTileCard({
  participant,
}: {
  participant: RemoteParticipant | LocalParticipant;
}) {
  const isLocal = participant instanceof LocalParticipant;
  const isMicOn = participant.isMicrophoneEnabled;
  const isCamOn = participant.isCameraEnabled;
  const isSpeaking = (participant as any).isSpeaking ?? false;

  // Get camera track using LiveKit's useTracks (only works inside LiveKitRoom)
  const allTracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ]);
  const myTrack = allTracks.find(
    (t) => t.participant.identity === participant.identity,
  );

  return (
    <div
      className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 bg-brand-black ${
        isSpeaking
          ? "border-brand-gold shadow-[0_0_16px_rgba(212,175,55,0.6)]"
          : "border-gray-800"
      }`}
      style={{ width: "100%", aspectRatio: "16/9" }}
    >
      {/* Camera or avatar */}
      {myTrack && isCamOn ? (
        <VideoTrack
          trackRef={myTrack as any}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <div className="w-12 h-12 rounded-full bg-linear-to-br from-brand-gold to-brand-brown flex items-center justify-center text-brand-black font-bold text-xl select-none">
            {participant.identity.charAt(0).toUpperCase()}
          </div>
          <span className="text-white text-[10px] font-medium truncate max-w-[90%] text-center mt-0.5">
            {participant.identity}
          </span>
        </div>
      )}

      {/* Bottom status bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-1.5 py-1 bg-linear-to-t from-black/80 to-transparent">
        <span className="text-white text-[9px] font-medium truncate max-w-[60%]">
          {participant.identity}
          {isLocal && <span className="text-brand-gold ml-0.5">(Tú)</span>}
        </span>
        <div className="flex items-center gap-0.5">
          {isMicOn ? (
            <Mic className="w-2.5 h-2.5 text-green-400" />
          ) : (
            <MicOff className="w-2.5 h-2.5 text-red-400" />
          )}
          {isCamOn ? (
            <Video className="w-2.5 h-2.5 text-green-400" />
          ) : (
            <VideoOff className="w-2.5 h-2.5 text-red-400" />
          )}
        </div>
      </div>

      {/* Speaking ring */}
      {isSpeaking && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-brand-gold animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

// ─── Participants Panel (2-col grid, scrollable — used for voice AND video) ───
function ParticipantsGrid({ username }: { username: string }) {
  const participants = useParticipants();

  if (participants.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-xs text-center px-3">
        Conectando a la sala...
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto p-2"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(212,175,55,0.3) transparent",
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        {participants.map((p) => (
          <ParticipantTileCard key={p.identity} participant={p} />
        ))}
      </div>
    </div>
  );
}

// ─── Simple Collaborative Canvas Whiteboard (no license required) ──────────────
// Uses HTML5 Canvas + Supabase realtime to sync strokes
interface Stroke {
  pts: [number, number][];
  color: string;
  size: number;
}

function CanvasWhiteboard({
  roomId,
  enabled,
}: {
  roomId: string;
  enabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const isDrawing = useRef(false);
  const lastSent = useRef(0);

  // Draw all strokes on canvas
  const redraw = useCallback(
    (allStrokes: Stroke[], current?: Stroke | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const stroke of allStrokes) {
        if (stroke.pts.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(stroke.pts[0][0], stroke.pts[0][1]);
        for (let i = 1; i < stroke.pts.length; i++) {
          ctx.lineTo(stroke.pts[i][0], stroke.pts[i][1]);
        }
        ctx.stroke();
      }

      if (current && current.pts.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = current.color;
        ctx.lineWidth = current.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(current.pts[0][0], current.pts[0][1]);
        for (let i = 1; i < current.pts.length; i++) {
          ctx.lineTo(current.pts[i][0], current.pts[i][1]);
        }
        ctx.stroke();
      }
    },
    [],
  );

  useEffect(() => {
    redraw(strokes, currentStroke);
  }, [strokes, currentStroke, redraw]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight || 400;
      redraw(strokes, currentStroke);
    });
    obs.observe(canvas.parentElement!);
    return () => obs.disconnect();
  }, [strokes, currentStroke, redraw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): [number, number] => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return [
        e.touches[0].clientX - rect.left,
        e.touches[0].clientY - rect.top,
      ];
    }
    return [
      (e as React.MouseEvent).clientX - rect.left,
      (e as React.MouseEvent).clientY - rect.top,
    ];
  };

  const startStroke = (e: React.MouseEvent | React.TouchEvent) => {
    if (!enabled) return;
    isDrawing.current = true;
    const pos = getPos(e);
    const newStroke: Stroke = {
      pts: [pos],
      color: tool === "eraser" ? "#ffffff" : color,
      size: tool === "eraser" ? size * 5 : size,
    };
    setCurrentStroke(newStroke);
  };

  const continueStroke = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !enabled || !currentStroke) return;
    e.preventDefault();
    const pos = getPos(e);
    const updated = {
      ...currentStroke,
      pts: [...currentStroke.pts, pos],
    };
    setCurrentStroke(updated);

    // Throttle broadcast via DataChannel (handled outside)
    const now = Date.now();
    if (now - lastSent.current > 50) {
      lastSent.current = now;
    }
  };

  const endStroke = () => {
    if (!isDrawing.current || !currentStroke) return;
    isDrawing.current = false;
    if (currentStroke.pts.length > 1) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke(null);
  };

  // DataChannel sync for whiteboard
  const { send: sendWB } = useDataChannel("whiteboard", (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.type === "STROKE") {
        setStrokes((prev) => [...prev, data.stroke]);
      } else if (data.type === "CLEAR") {
        setStrokes([]);
      }
    } catch {}
  });

  const finishAndBroadcast = () => {
    if (!isDrawing.current || !currentStroke) return;
    isDrawing.current = false;
    if (currentStroke.pts.length > 1) {
      const stroke = currentStroke;
      setStrokes((prev) => [...prev, stroke]);
      sendWB(
        new TextEncoder().encode(JSON.stringify({ type: "STROKE", stroke })),
        { reliable: true },
      );
    }
    setCurrentStroke(null);
  };

  const clearCanvas = () => {
    setStrokes([]);
    setCurrentStroke(null);
    sendWB(new TextEncoder().encode(JSON.stringify({ type: "CLEAR" })), {
      reliable: true,
    });
  };

  const COLORS = [
    "#000000",
    "#ef4444",
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
    "#ffffff",
  ];

  return (
    <div className="w-full h-full flex flex-col bg-white relative">
      {/* Toolbar — only shown if enabled */}
      {enabled && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex-wrap shrink-0">
          {/* Colors */}
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setTool("pen");
                }}
                className={`w-5 h-5 rounded-full border-2 transition-all ${color === c && tool === "pen" ? "border-brand-gold scale-125" : "border-gray-400"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="w-px h-4 bg-gray-300" />
          {/* Size */}
          <input
            type="range"
            min={1}
            max={20}
            value={size}
            onChange={(e) => setSize(+e.target.value)}
            className="w-16 h-1 accent-brand-gold"
          />
          <div className="w-px h-4 bg-gray-300" />
          {/* Tools */}
          <button
            onClick={() => setTool("pen")}
            className={`p-1 rounded ${tool === "pen" ? "bg-brand-gold text-brand-black" : "text-gray-600 hover:bg-gray-200"}`}
          >
            <PenLine className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={`p-1 rounded ${tool === "eraser" ? "bg-brand-gold text-brand-black" : "text-gray-600 hover:bg-gray-200"}`}
          >
            <Eraser className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-300" />
          <button
            onClick={clearCanvas}
            className="text-xs text-red-500 font-bold hover:underline px-1"
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${enabled ? "cursor-crosshair" : "cursor-not-allowed"}`}
          onMouseDown={startStroke}
          onMouseMove={continueStroke}
          onMouseUp={finishAndBroadcast}
          onMouseLeave={finishAndBroadcast}
          onTouchStart={startStroke}
          onTouchMove={continueStroke}
          onTouchEnd={finishAndBroadcast}
        />
        {!enabled && (
          <div className="absolute top-2 left-2 z-10 bg-brand-black/80 text-brand-gold text-xs font-bold px-2 py-1 rounded-full border border-brand-gold/30 pointer-events-none">
            Solo visualización
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inner Room (main layout) ─────────────────────────────────────────────────
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
  // "presentation" mode: "whiteboard" | "video" | "screenshare"
  const [presentationMode, setPresentationMode] = useState<
    "whiteboard" | "video" | "screenshare"
  >("whiteboard");
  const [sharedVideoUrl, setSharedVideoUrl] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoInput, setVideoInput] = useState("");
  const [permissionToast, setPermissionToast] = useState<string | null>(null);
  // Permission request modal (for host)
  const [permissionRequest, setPermissionRequest] = useState<{
    from: string;
    action: string;
  } | null>(null);
  // Whether this student was granted whiteboard permission by host
  const [wbGranted, setWbGranted] = useState(false);

  const canShare = role === "profesor" || role === "admin" || isCreator;

  const showToast = (msg: string) => {
    setPermissionToast(msg);
    setTimeout(() => setPermissionToast(null), 4000);
  };

  // ── DataChannel: Video & Presentation State Sync + End Call + Permission Req ─
  const { send } = useDataChannel("presentation", (msg) => {
    try {
      const data = JSON.parse(new TextDecoder().decode(msg.payload));
      if (data.type === "SHARE_VIDEO") {
        setSharedVideoUrl(data.url);
        setPresentationMode("video");
      } else if (data.type === "STOP_VIDEO") {
        setSharedVideoUrl(null);
        setPresentationMode("whiteboard");
      } else if (data.type === "SHOW_WHITEBOARD") {
        setPresentationMode("whiteboard");
        setSharedVideoUrl(null);
      } else if (data.type === "CALL_ENDED") {
        // Host ended the call — everyone must leave
        onLeave();
      } else if (data.type === "PERMISSION_REQUEST" && canShare) {
        // Host receives permission request from a student — show modal
        setPermissionRequest({ from: data.from, action: data.action });
      } else if (data.type === "PERMISSION_GRANTED") {
        // Student receives grant — check if it's for them
        if (data.to === username) {
          setWbGranted(true);
          showToast("✅ El profesor te dio permiso");
        }
      }
    } catch {}
  });

  // Send permission request to host via DataChannel
  const sendPermissionRequest = (action: string) => {
    send(
      new TextEncoder().encode(
        JSON.stringify({ type: "PERMISSION_REQUEST", from: username, action }),
      ),
      { reliable: true },
    );
    showToast(`Solicitud enviada al profesor para ${action}`);
  };

  // Host grants permission to student
  const grantPermission = (to: string) => {
    send(
      new TextEncoder().encode(
        JSON.stringify({ type: "PERMISSION_GRANTED", to }),
      ),
      { reliable: true },
    );
    setPermissionRequest(null);
    showToast(`✅ Permiso concedido a ${to}`);
  };

  const broadcastVideo = (url: string) => {
    send(
      new TextEncoder().encode(JSON.stringify({ type: "SHARE_VIDEO", url })),
      { reliable: true },
    );
    setSharedVideoUrl(url);
    setPresentationMode("video");
    setShowVideoModal(false);
    setVideoInput("");
  };

  const stopVideo = () => {
    send(new TextEncoder().encode(JSON.stringify({ type: "STOP_VIDEO" })), {
      reliable: true,
    });
    setSharedVideoUrl(null);
    setPresentationMode("whiteboard");
  };

  // ── Screen share track detection ──────────────────────────────────────────
  const screenTracks = useTracks([
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  const activeScreenTrack = screenTracks.length > 0 ? screenTracks[0] : null;

  // When someone shares screen, show it in the right pane
  useEffect(() => {
    if (activeScreenTrack) {
      setPresentationMode("screenshare");
    } else if (presentationMode === "screenshare") {
      setPresentationMode("whiteboard");
    }
  }, [activeScreenTrack]);

  return (
    <div className="flex flex-col h-full bg-brand-black overflow-hidden">
      {/* ── Toast ── */}
      {permissionToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-70 bg-brand-gold text-brand-black font-semibold px-5 py-2.5 rounded-full shadow-2xl text-sm whitespace-nowrap">
          {permissionToast}
        </div>
      )}

      {/* ── Permission Request Modal (host only) ── */}
      {permissionRequest && (
        <div className="absolute inset-0 z-80 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-brand-gold/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <p className="text-2xl mb-2">📩</p>
            <h3 className="text-white font-bold text-lg mb-1">
              {permissionRequest.from}
            </h3>
            <p className="text-gray-400 text-sm mb-5">
              solicita permiso para:{" "}
              <span className="text-brand-gold font-semibold">
                {permissionRequest.action}
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => grantPermission(permissionRequest.from)}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-colors"
              >
                ✓ Aceptar
              </button>
              <button
                onClick={() => setPermissionRequest(null)}
                className="flex-1 py-2.5 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded-xl transition-colors"
              >
                ✕ Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Row ── */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* LEFT: Participant tiles — 2-col grid, scrollable */}
        <div
          className="shrink-0 bg-zinc-950 flex flex-col border-brand-gold/20"
          style={{
            width: "100%",
            maxWidth: "22rem",
            borderRight: "1px solid rgba(212,175,55,0.15)",
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-brand-gold/10 flex items-center justify-between shrink-0">
            <span className="text-brand-gold text-[11px] font-bold uppercase tracking-widest">
              Participantes
            </span>
          </div>

          {/* Always show the same 2-col participant grid for both voice and video */}
          <ParticipantsGrid username={username} />
          <RoomAudioRenderer />
        </div>

        {/* RIGHT: Presentation area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Mode tabs — only for privileged users */}
          {canShare && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 border-b border-brand-gold/10 shrink-0">
              <button
                onClick={() => {
                  setPresentationMode("whiteboard");
                  send(
                    new TextEncoder().encode(
                      JSON.stringify({ type: "SHOW_WHITEBOARD" }),
                    ),
                    { reliable: true },
                  );
                }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${presentationMode === "whiteboard" ? "bg-brand-gold text-brand-black" : "text-gray-400 hover:text-white"}`}
              >
                Pizarra
              </button>
              <button
                onClick={() => setShowVideoModal(true)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${presentationMode === "video" ? "bg-brand-gold text-brand-black" : "text-gray-400 hover:text-white"}`}
              >
                Video
              </button>
              {presentationMode === "video" && (
                <button
                  onClick={stopVideo}
                  className="px-3 py-1 rounded-full text-xs font-bold text-red-400 hover:text-red-300 ml-auto"
                >
                  ✕ Detener video
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 relative overflow-hidden">
            {presentationMode === "screenshare" && activeScreenTrack ? (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <VideoTrack
                  trackRef={activeScreenTrack as any}
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 left-3 bg-brand-black/80 text-brand-gold text-xs px-2 py-1 rounded-full border border-brand-gold/30">
                  Pantalla compartida
                </div>
              </div>
            ) : presentationMode === "video" && sharedVideoUrl ? (
              <div className="w-full h-full bg-black">
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
              /* Whiteboard — always shown by default */
              <div className="w-full h-full relative">
                <CanvasWhiteboard
                  roomId={roomName}
                  enabled={canShare || wbGranted}
                />
                {!canShare && !wbGranted && (
                  // Student overlay: click to send real permission request
                  <div
                    className="absolute inset-0 z-10 cursor-pointer"
                    onClick={() =>
                      sendPermissionRequest("interactuar con la pizarra")
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Control Bar (bottom row, NOT overlapping content) ── */}
      <div className="shrink-0 flex justify-center py-3 bg-zinc-950 border-t border-brand-gold/10">
        <CustomControlBar
          onLeave={() => {
            // If privileged (creator/teacher), broadcast CALL_ENDED to kick everyone
            if (canShare) {
              send(
                new TextEncoder().encode(
                  JSON.stringify({ type: "CALL_ENDED" }),
                ),
                { reliable: true },
              );
            }
            onLeave();
          }}
          videoEnabled={videoEnabled}
          onShareVideo={() => {
            if (canShare) setShowVideoModal(true);
            else sendPermissionRequest("compartir video");
          }}
          onRequestPermission={sendPermissionRequest}
          isVideoOpen={presentationMode === "video"}
          canShare={canShare}
        />
      </div>

      {/* ── Video Share Modal ── */}
      {showVideoModal && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-brand-gold/50 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-500" /> Compartir Video
            </h3>
            {canShare ? (
              <>
                <input
                  type="text"
                  value={videoInput}
                  onChange={(e) => setVideoInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    videoInput.trim() &&
                    broadcastVideo(videoInput.trim())
                  }
                  placeholder="YouTube URL o link directo..."
                  className="w-full bg-brand-black border border-gray-700 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-gold mb-4 text-sm"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowVideoModal(false)}
                    className="px-4 py-1.5 text-gray-400 hover:text-white text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() =>
                      videoInput.trim() && broadcastVideo(videoInput.trim())
                    }
                    className="px-5 py-2 bg-brand-gold text-brand-black font-bold rounded-xl flex items-center gap-2 text-sm"
                  >
                    <Play className="w-4 h-4" /> Reproducir
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <Ban className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-gray-300 text-sm mb-4">
                  Solo el profesor o el creador pueden compartir videos.
                </p>
                <button
                  onClick={() => {
                    setShowVideoModal(false);
                    showToast(
                      "Solicitud enviada al profesor para compartir video",
                    );
                  }}
                  className="px-6 py-2 bg-brand-gold text-brand-black font-bold rounded-full text-sm"
                >
                  Enviar Solicitud
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Control Bar ─────────────────────────────────────────────────────────────
function CustomControlBar({
  onLeave,
  videoEnabled = true,
  onShareVideo,
  onRequestPermission,
  isVideoOpen,
  canShare,
}: {
  onLeave: () => void;
  videoEnabled?: boolean;
  onShareVideo: () => void;
  onRequestPermission: (msg: string) => void;
  isVideoOpen: boolean;
  canShare: boolean;
}) {
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const room = useRoomContext();

  // Enable mic on mount (safe — user already granted permission in startCall)
  useEffect(() => {
    if (!localParticipant) return;
    localParticipant.setMicrophoneEnabled(true).catch(() => {});
    if (videoEnabled) {
      localParticipant.setCameraEnabled(true).catch(() => {});
    }
  }, [localParticipant, videoEnabled]);

  const toggleMic = async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {}
  };

  const toggleCam = async () => {
    if (!localParticipant || !videoEnabled) return;
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {}
  };

  const toggleScreen = async () => {
    if (!localParticipant) return;
    if (!canShare) {
      onRequestPermission("compartir pantalla");
      return;
    }
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch {}
  };

  const handleLeave = () => {
    room?.disconnect();
    onLeave();
  };

  const btn =
    "p-3 rounded-full transition-all duration-200 hover:scale-110 border border-white/10 flex items-center justify-center";

  return (
    <div className="flex items-center gap-2 bg-black/70 px-5 py-2.5 rounded-2xl border border-brand-gold/20 shadow-2xl backdrop-blur-xl">
      {/* Mic */}
      <button
        onClick={toggleMic}
        title={isMicrophoneEnabled ? "Silenciar" : "Activar mic"}
        className={`${btn} ${isMicrophoneEnabled ? "bg-zinc-900 text-brand-gold" : "bg-red-500/20 text-red-400"}`}
      >
        {isMicrophoneEnabled ? (
          <Mic className="w-5 h-5" />
        ) : (
          <MicOff className="w-5 h-5" />
        )}
      </button>

      {/* Cam */}
      {videoEnabled && (
        <button
          onClick={toggleCam}
          title={isCameraEnabled ? "Apagar cámara" : "Activar cámara"}
          className={`${btn} ${isCameraEnabled ? "bg-zinc-900 text-brand-gold" : "bg-red-500/20 text-red-400"}`}
        >
          {isCameraEnabled ? (
            <Video className="w-5 h-5" />
          ) : (
            <VideoOff className="w-5 h-5" />
          )}
        </button>
      )}

      {/* Screen Share */}
      <button
        onClick={toggleScreen}
        title="Compartir pantalla"
        className={`${btn} ${isScreenShareEnabled ? "bg-green-500/20 text-green-400" : "bg-zinc-900 text-gray-500"}`}
      >
        <Monitor className="w-5 h-5" />
      </button>

      {/* Video Share (YouTube) */}
      <button
        onClick={onShareVideo}
        title="Compartir video"
        className={`${btn} ${isVideoOpen ? "bg-brand-gold text-brand-black" : "bg-zinc-900 text-brand-gold"}`}
      >
        <Youtube className="w-5 h-5" />
      </button>

      <div className="w-px h-7 bg-white/10 mx-1" />

      {/* Hangup */}
      <button
        onClick={handleLeave}
        title="Colgar"
        className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all hover:scale-110 shadow-[0_0_12px_rgba(220,38,38,0.5)] border-2 border-red-500"
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}
