"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function StudyRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Generate a shorter, friendly ID for the room
    const roomId =
      Math.random().toString(36).substring(2, 8) +
      "-" +
      Math.random().toString(36).substring(2, 8);
    router.replace(`/study/room/${roomId}`);
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
      <Loader2 className="w-10 h-10 animate-spin text-brand-gold mb-4" />
      <p className="text-gray-400">Creando sala de estudio...</p>
    </div>
  );
}
