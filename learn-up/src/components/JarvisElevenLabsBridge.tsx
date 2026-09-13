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
  const requestRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synthesis = window.speechSynthesis;
    const originalSpeak = synthesis.speak.bind(synthesis);
    const originalCancel = synthesis.cancel.bind(synthesis);

    const stopAudio = () => {
      generationRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        const source = audioRef.current.src;
        audioRef.current.src = "";
        if (source.startsWith("blob:")) URL.revokeObjectURL(source);
        audioRef.current = null;
      }
    };

    const handleMuteClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("button[title='Silenciar']");
      if (button) stopAudio();
    };

    synthesis.cancel = () => {
      stopAudio();
      originalCancel();
    };

    synthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      const text = String(utterance?.text || "").trim();
      if (!text) return;

      stopAudio();
      const generation = generationRef.current;
      const controller = new AbortController();
      requestRef.current = controller;

      void (async () => {
        try {
          const response = await fetch("/api/jarvis/voice", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text }),
            signal: controller.signal,
          });

          const result = await response.json();
          if (generation !== generationRef.current || controller.signal.aborted) return;

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

          if (generation !== generationRef.current || controller.signal.aborted) {
            audio.pause();
            URL.revokeObjectURL(url);
            if (audioRef.current === audio) audioRef.current = null;
            return;
          }

          await audio.play();
        } catch (error: any) {
          if (error?.name === "AbortError") return;
          console.error("[Jarvis Voice] Error reproduciendo ElevenLabs:", error);
        } finally {
          if (requestRef.current === controller) requestRef.current = null;
        }
      })();
    };

    document.addEventListener("click", handleMuteClick, true);

    return () => {
      stopAudio();
      document.removeEventListener("click", handleMuteClick, true);
      synthesis.speak = originalSpeak;
      synthesis.cancel = originalCancel;
    };
  }, []);

  return null;
}
