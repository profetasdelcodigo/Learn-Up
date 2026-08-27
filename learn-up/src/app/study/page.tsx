"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLoader from "@/components/PageLoader";

export default function StudyRedirect() {
  const router = useRouter();

  useEffect(() => {
    const roomId =
      Math.random().toString(36).substring(2, 8) +
      "-" +
      Math.random().toString(36).substring(2, 8);
    router.replace(`/study/room/${roomId}`);
  }, [router]);

  return <PageLoader label="Creando sala de estudio..." />;
}
