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

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Delay rendering to ensure parent container has dimensions
    // Fixes 'getBoundingClientRect' error
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-white">
      <Tldraw
        onMount={handleMount}
        persistenceKey={`room-${roomId}`} // Keep local persistence
        options={{ maxPages: 1 }}
      />
    </div>
  );
}
