"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Tldraw, Editor } from "tldraw";
import "tldraw/tldraw.css";

export default function Whiteboard({ roomId }: { roomId: string }) {
  const editorRef = useRef<Editor | null>(null);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // Fix black screen issue by forcing viewport update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editorRef.current) {
        try {
          (editorRef.current as any).zoomToFit();
          window.dispatchEvent(new Event("resize")); // Force browser layout recalc
        } catch (e) {
          console.error("Error updating viewport:", e);
        }
      }
    }, 800);

    const timer2 = setTimeout(() => {
      if (editorRef.current) {
        try {
          window.dispatchEvent(new Event("resize"));
        } catch (e) {
          console.error("Error updating viewport backup:", e);
        }
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const isReady = dimensions.width > 0 && dimensions.height > 0;

  return (
    <div ref={containerRef} className="w-full h-full relative bg-white">
      {!isReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
        </div>
      ) : null}

      {isReady && (
        <Tldraw
          onMount={handleMount}
          persistenceKey={`room-${roomId}`} // Keep local persistence
          options={{ maxPages: 1 }}
        />
      )}
    </div>
  );
}
