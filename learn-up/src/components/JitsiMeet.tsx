"use client";

import { useEffect, useRef, useState } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";

interface JitsiMeetProps {
  roomName: string;
  displayName: string;
  onClose: () => void;
  onWhiteboardToggle?: () => void;
  showWhiteboard?: boolean;
}

export default function JitsiMeet({
  roomName,
  displayName,
  onClose,
  onWhiteboardToggle,
  showWhiteboard = false,
}: JitsiMeetProps) {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [api, setApi] = useState<any>(null);

  useEffect(() => {
    // Load Jitsi Meet API script
    const script = document.createElement("script");
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = () => initJitsi();
    document.body.appendChild(script);

    return () => {
      // Cleanup
      if (api) {
        api.dispose();
      }
      document.body.removeChild(script);
    };
  }, []);

  const initJitsi = () => {
    if (!jitsiContainerRef.current) return;

    // @ts-ignore - JitsiMeetExternalAPI is loaded from external script
    const jitsiApi = new window.JitsiMeetExternalAPI("meet.jit.si", {
      roomName: roomName,
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: displayName,
      },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        enableWelcomePage: false,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: [
          "microphone",
          "camera",
          "closedcaptions",
          "desktop",
          "fullscreen",
          "fodeviceselection",
          "hangup",
          "chat",
          "settings",
          "raisehand",
          "videoquality",
          "filmstrip",
          "tileview",
          "select-background",
          "mute-everyone",
        ],
      },
    });

    setApi(jitsiApi);

    // Listen for hangup event
    jitsiApi.addEventListener("readyToClose", () => {
      onClose();
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/95 flex flex-col ${
        isFullscreen ? "" : "p-4"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
        <h2 className="text-white font-bold">Videollamada</h2>
        <div className="flex items-center gap-2">
          {onWhiteboardToggle && (
            <button
              onClick={onWhiteboardToggle}
              className={`px-4 py-2 rounded-lg transition-all ${
                showWhiteboard
                  ? "bg-brand-gold text-brand-black"
                  : "bg-gray-800 text-white hover:bg-gray-700"
              }`}
            >
              {showWhiteboard ? "Ocultar Pizarra" : "Mostrar Pizarra"}
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-800 rounded-lg text-white transition-colors"
            title={
              isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"
            }
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-600 rounded-lg text-white transition-colors"
            title="Cerrar llamada"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Jitsi Container */}
      <div
        ref={jitsiContainerRef}
        className="flex-1 w-full bg-black"
        style={{ minHeight: "400px" }}
      />
    </div>
  );
}
