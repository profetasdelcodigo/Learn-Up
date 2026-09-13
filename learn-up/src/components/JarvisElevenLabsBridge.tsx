"use client";

import { useEffect, useRef } from "react";

function decodeAudio(base64: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: "audio/mpeg" });
}

export default function JarvisElevenLabsBridge() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const originalSpeakRef = useRef<((utterance: SpeechSynthesisUtterance) => void) | null>(null);
  const originalCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synthesis = window.speechSynthesis;
    const originalSpeak = synthesis.speak.bind(synthesis);
    const originalCancel = synthesis.cancel.bind(synthesis);
    originalSpeakRef.current = originalSpeak;
    originalCancelRef.current = originalCancel;

    const stopAudio = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = "";
      }
    };

    synthesis.cancel = () => {
      stopAudio();
      originalCancel();
    };

    synthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      const text = String(utterance?.text || "").trim();
      if (!text) return;

      stopAudio();

      void (async () => {
        try {
          const response = await fetch("/api/jarvis/voice", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text }),
          });

          const result = await response.json();
          if (!response.ok || !result?.success || !result?.base64) {
            console.error("[Jarvis Voice] ElevenLabs no disponible:", result?.error || response.status);
            return;
          }

          const blob = decodeAudio(result.base64);
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.preload = "auto";
          audioRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            if (audioRef.current === audio) audioRef.current = null;
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            if (audioRef.current === audio) audioRef.current = null;
          };

          await audio.play();
        } catch (error) {
          console.error("[Jarvis Voice] Error reproduciendo ElevenLabs:", error);
        }
      })();
    };

    return () => {
      stopAudio();
      synthesis.speak = originalSpeak;
      synthesis.cancel = originalCancel;
      originalSpeakRef.current = null;
      originalCancelRef.current = null;
    };
  }, []);

  return null;
}
