"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Tldraw, Editor, TldrawOptions } from "tldraw";
import "tldraw/tldraw.css";
import { createClient } from "@/utils/supabase/client";

// Debounce helper
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export default function Whiteboard({ roomId }: { roomId: string }) {
  const supabase = createClient();
  const editorRef = useRef<Editor | null>(null);
  const isLocalChange = useRef(false);

  // Initial Data Load & Subscription setup
  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;

      // 1. Load Initial Data
      const loadInitialData = async () => {
        const { data, error } = await supabase
          .from("study_groups")
          .select("pizarra_data")
          .eq("id", roomId)
          .single();

        if (data?.pizarra_data && Object.keys(data.pizarra_data).length > 0) {
          try {
            // Disable history for initial load to avoid undoing into empty state
            (editor as any).history.ignore(() => {
              (editor.store as any).loadSnapshot(data.pizarra_data);
            });
          } catch (e) {
            console.error("Error loading snapshot:", e);
          }
        } else if (!data) {
          // Create room if not exists
          await supabase
            .from("study_groups")
            .insert({ id: roomId, pizarra_data: {} })
            .select()
            .single();
        }
      };

      loadInitialData();

      // 2. Subscribe to Valid Changes (Remote)
      const channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "study_groups",
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            // Verify if the update is from us (this client) to avoid loops?
            // Realtime doesn't easily give source ID unless we send it.
            // We can check if implicit local change flag is set? No.
            // Simplest check: compare snapshots? Expensive.
            // Or just load it if we aren't currently dragging?
            // For MVP "Cuadro negro fix", we just load.
            if (isLocalChange.current) {
              isLocalChange.current = false;
              return;
            }

            const newData = payload.new.pizarra_data;
            if (newData && Object.keys(newData).length > 0) {
              try {
                // We compare basics to avoid jitter
                // If user is editing, this might interrupt.
                // Ideal implementation requires Yjs/CRDT.
                // For "Snapshot via DB", last write wins.
                (editor.store as any).loadSnapshot(newData);
              } catch (e) {
                console.error(e);
              }
            }
          },
        )
        .subscribe();

      // 3. Listen to Local Changes -> Save
      const saveData = debounce(async () => {
        if (!editorRef.current) return;
        const snapshot = (editorRef.current.store as any).getSnapshot();

        // Mark as local change for some ms (race condition possible but okay for MVP)
        isLocalChange.current = true;
        setTimeout(() => (isLocalChange.current = false), 500);

        await supabase
          .from("study_groups")
          .upsert({ id: roomId, pizarra_data: snapshot as any }); // Cast any for JSONB
      }, 1000);

      const cleanupListener = editor.store.listen((change) => {
        // Only save on doc changes (not selection/presence)
        if (change.source === "user") {
          saveData();
        }
      });

      return () => {
        cleanupListener();
        supabase.removeChannel(channel);
      };
    },
    [roomId, supabase],
  );

  return (
    <div className="w-full h-full relative bg-white">
      <Tldraw
        onMount={handleMount}
        persistenceKey={`room-${roomId}`} // Keep local persistence as fallback
        options={{ maxPages: 1 }}
      />
    </div>
  );
}
