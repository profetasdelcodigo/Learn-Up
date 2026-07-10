import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Obtenemos los eventos personales
  const { data: events, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    return new NextResponse("Error fetching events", { status: 500 });
  }

  // Generar contenido ICS (Formato iCalendar)
  let icsContent = "BEGIN:VCALENDAR\\nVERSION:2.0\\nPRODID:-//Learn Up//Calendar//EN\\n";
  
  if (events && events.length > 0) {
    for (const ev of events) {
      icsContent += "BEGIN:VEVENT\\n";
      icsContent += \`UID:\${ev.id}\\n\`;
      icsContent += \`SUMMARY:\${ev.title}\\n\`;
      
      // Parse dates properly. Assuming ISO format YYYY-MM-DDTHH:mm:ssZ
      const formatIcsDate = (dateString: string) => {
        const d = new Date(dateString);
        return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      };

      if (ev.start_time) icsContent += \`DTSTART:\${formatIcsDate(ev.start_time)}\\n\`;
      if (ev.end_time) icsContent += \`DTEND:\${formatIcsDate(ev.end_time)}\\n\`;
      if (ev.description) icsContent += \`DESCRIPTION:\${ev.description}\\n\`;
      
      icsContent += "END:VEVENT\\n";
    }
  }

  icsContent += "END:VCALENDAR";

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar",
      "Content-Disposition": \`attachment; filename="learnup-calendar.ics"\`,
    },
  });
}
