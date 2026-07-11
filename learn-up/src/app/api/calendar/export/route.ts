import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    return new NextResponse("Error fetching events", { status: 500 });
  }

  // Generar contenido ICS (iCalendar)
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Learn Up//Calendar//EN",
  ];

  if (events && events.length > 0) {
    for (const ev of events) {
      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + ev.id);
      lines.push("SUMMARY:" + (ev.title || "Sin título"));

      const fmtDate = (d: string) => {
        return new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };

      if (ev.start_time) lines.push("DTSTART:" + fmtDate(ev.start_time));
      if (ev.end_time) lines.push("DTEND:" + fmtDate(ev.end_time));
      if (ev.description) lines.push("DESCRIPTION:" + ev.description.replace(/\n/g, "\\n"));

      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  const icsContent = lines.join("\r\n");

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="learnup-calendar.ics"',
    },
  });
}
