import type { Skill, ToolDefinition } from "../core/types";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

const elevenLabsTts: ToolDefinition = {
  id: "text_to_speech",
  category: "multimedia",
  name: "Voz Learn Up (ElevenLabs)",
  description: "Convierte texto a voz usando ElevenLabs con la voz configurada para Learn Up.",
  risk: "write",
  requiresConfirmation: true,
  supportsAutopilot: false,
  schema: {
    parse: (value: unknown) => value,
  } as any,
  execute: async (args: any) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";

    if (!apiKey) {
      return { success: false, error: "ELEVENLABS_API_KEY no está configurada." };
    }
    if (!voiceId) {
      return { success: false, error: "ELEVENLABS_VOICE_ID no está configurada." };
    }

    const text = String(args?.text || "").trim();
    if (!text) return { success: false, error: "No se proporcionó texto para sintetizar." };
    if (text.length > 10000) return { success: false, error: "El texto supera el máximo de 10 000 caracteres." };

    const response = await fetch(`${ELEVENLABS_API_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: Number(process.env.ELEVENLABS_STABILITY || 0.72),
          similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY_BOOST || 0.88),
          style: Number(process.env.ELEVENLABS_STYLE || 0.18),
          speed: Number(process.env.ELEVENLABS_SPEED || 0.96),
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`ElevenLabs ${response.status}: ${details}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      success: true,
      message: "Audio generado con ElevenLabs.",
      data: {
        base64: buffer.toString("base64"),
        mimeType: "audio/mpeg",
        provider: "elevenlabs",
        model: modelId,
        voiceId,
      },
    };
  },
};

export function withElevenLabsTts(skill: Skill): Skill {
  if (skill.id !== "multimedia") return skill;
  return {
    ...skill,
    tools: skill.tools.map((tool) => (tool.id === "text_to_speech" ? elevenLabsTts : tool)),
  };
}
