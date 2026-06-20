import { NextRequest, NextResponse } from "next/server";
import { POST as signOut } from "@/app/api/auth/signout/route";

export async function POST(request: NextRequest) {
  return signOut(request);
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url), { status: 307 });
}
