import { NextResponse } from "next/server";
import { approveTutorRole } from "@/actions/role";

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

    const result = await approveTutorRole(user_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
