import { NextRequest } from "next/server";

const JAILBREAK_PATTERNS = [
  /ignora( todas)? las instrucciones/i,
  /ignore( all)? previous instructions/i,
  /actúa como/i,
  /act as/i,
  /dan /i,
  /bypass/i,
  /desactiva(r)? los filtros/i,
  /eres un desarrollador( y| que)?/i,
  /system prompt/i,
  /revela tus instrucciones/i,
  /reveal your instructions/i,
];

export async function checkJarvisSecurity(req: NextRequest | Request, userId: string, message: string) {
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(message)) {
      console.warn(`[JARVIS GUARD] Intento de jailbreak detectado del usuario ${userId}: ${message}`);
      return { 
        safe: false, 
        reason: "jailbreak_attempt",
        message: "No puedo cumplir con esa solicitud. Mi propósito es ayudarte en tu aprendizaje y organización dentro de los límites éticos establecidos."
      };
    }
  }

  if (message.length > 2000) {
      return {
          safe: false,
          reason: "malicious_payload",
          message: "El mensaje es demasiado largo. Por favor, sé más conciso."
      };
  }

  return { safe: true };
}
