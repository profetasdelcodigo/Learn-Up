import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import webPush from "npm:web-push@3.6.7"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@learnup.com";

try {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
  console.warn("web-push VAPID configuration error:", e);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { targetUserId, title, message, url, tag } = await req.json();

    if (!targetUserId) {
        return new Response(JSON.stringify({ error: "Missing targetUserId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    // Verify Relationship (Simplified: usually check friends or room members)
    // Assuming the application logic validates it before calling, or we add RLS equivalents here.
    
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", targetUserId);

    if (fetchError || !subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ error: "No subscriptions found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payload = JSON.stringify({
      title,
      message,
      link: url,
      tag
    });

    const sendPromises = subscriptions.map(async (subRecord) => {
      try {
        const sub = typeof subRecord.subscription === 'string' ? JSON.parse(subRecord.subscription) : subRecord.subscription;
        await webPush.sendNotification(sub, payload);
        
        // Log success
        await supabaseAdmin.from("notification_log").insert({
          user_id: targetUserId,
          type: "push",
          payload: JSON.parse(payload),
          status: "success"
        });
        return { success: true };
      } catch (err: any) {
        console.error("Push sending error:", err);
        // Log failure
        await supabaseAdmin.from("notification_log").insert({
          user_id: targetUserId,
          type: "push",
          payload: JSON.parse(payload),
          status: "failed - " + err.message
        });
        // If 410 Gone, we should delete the subscription
        if (err.statusCode === 410 || err.statusCode === 404) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", targetUserId);
        }
        return { success: false, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})
