import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    // 1. Check basic Next.js routing and memory
    const memory = process.memoryUsage();
    
    // 2. Check Database connection
    let dbStatus = "unknown";
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await supabase.from('profiles').select('id').limit(1);
      if (error) throw error;
      dbStatus = "healthy";
    } catch (dbErr) {
      dbStatus = "error";
      console.error("Health Check - DB Error:", dbErr);
    }

    const isHealthy = dbStatus === "healthy";

    return NextResponse.json(
      {
        status: isHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        checks: {
          database: dbStatus,
          api: "healthy",
        },
        system: {
          uptime: process.uptime(),
          memory: {
            rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
          }
        }
      },
      { status: isHealthy ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: "error", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
