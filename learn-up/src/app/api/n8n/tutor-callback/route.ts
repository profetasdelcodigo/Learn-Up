import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { user_id, action, secret } = data;

    const expectedSecret = process.env.N8N_WEBHOOK_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!user_id || action !== "approve_tutor") {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseKey) {
       console.error("Faltan credenciales de Supabase en el entorno.");
       return NextResponse.json({ error: "Configuración del servidor incompleta" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from("profiles")
      .update({ role: "profesor" })
      .eq("id", user_id);

    if (error) {
      console.error("Error actualizando rol a profesor:", error);
      return NextResponse.json({ error: "Error interno de DB" }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
