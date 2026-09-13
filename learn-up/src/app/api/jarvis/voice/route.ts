import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";

    if (!apiKey || !voiceId) {
      return NextResponse.json(
        { success: false, error: "La voz ElevenLabs no está configurada en el servidor." },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => null);
    const text = String(body?.text || "").trim();
    if (!text) {
      return NextResponse.json({ success: false, error: "No se proporcionó texto." }, { status: 400 });
    }
    if (text.length > 10000) {
      return NextResponse.json({ success: false, error: "El texto es demasiado largo." }, { status: 400 });
    }

    const response = await fetch(
      `${ELEVENLABS_API_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
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
      },
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("[Jarvis Voice] ElevenLabs error", response.status, details.slice(0, 500));
      return NextResponse.json({ success: false, error: "No se pudo generar la voz." }, { status: 502 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return NextResponse.json({
      success: true,
      mimeType: "audio/mpeg",
      base64: buffer.toString("base64"),
      provider: "elevenlabs",
      model: modelId,
    });
  } catch (error) {
    console.error("[Jarvis Voice] Unexpected error", error);
    return NextResponse.json({ success: false, error: "Error interno de voz." }, { status: 500 });
  }
}
