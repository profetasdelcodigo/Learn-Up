import { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
// Mock de Redis o Supabase KV si no hay Upstash
// import { Redis } from "@upstash/redis"; 

const JAILBREAK_PATTERNS = [
  /ignora( todas)? las instrucciones/i,
  /ignore( all)? previous instructions/i,
  /actúa como/i,
  /act as/i,
  /dan /i, // Do Anything Now
  /bypass/i,
  /desactiva(r)? los filtros/i,
  /eres un desarrollador( y| que)?/i,
];

// Opcional: Rate limiter usando Upstash (mockeado para este entorno si no hay Redis)
// const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
// const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m") });

export async function checkJarvisSecurity(req: NextRequest | Request, userId: string, message: string) {
  // 1. Detección de Jailbreak
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(message)) {
      console.warn(`[JARVIS GUARD] Intento de jailbreak detectado del usuario ${userId}: ${message}`);
      return { 
        safe: false, 
        reason: "jailbreak_attempt",
        message: "No puedo cumplir con esa solicitud. Por favor, reformula tu pregunta dentro de mis capacidades de tutor."
      };
    }
  }

  // 2. Limite de velocidad (Rate Limiting) - Requiere Upstash Redis u otra BD
  // Si no tenemos Redis configurado, saltamos este paso.
  if (process.env.UPSTASH_REDIS_REST_URL) {
     try {
         // const { success } = await ratelimit.limit(`jarvis_${userId}`);
         // if (!success) {
         //    return { safe: false, reason: "rate_limit", message: "Has enviado demasiados mensajes seguidos. Por favor, espera un minuto." };
         // }
     } catch (e) {
         console.error("Error en Rate Limiting:", e);
     }
  }

  // 3. Logging de seguridad / telemetría
  // Podríamos registrar todas las consultas a un bucket de log para auditoría
  // console.log(`[JARVIS AUDIT] [${new Date().toISOString()}] User:${userId} Length:${message.length}`);

  return { safe: true };
}
