import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check if we have a user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
  }

  const PRODUCTION_URL = "https://learn-up-qmgx.onrender.com";
  return NextResponse.redirect(`${PRODUCTION_URL}/`, {
    status: 302,
  });
}
