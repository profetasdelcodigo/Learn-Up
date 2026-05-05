import { createClient } from "@/utils/supabase/server";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface ToolAction {
  tool: string;
  args: Record<string, any>;
  description: string;
  requiresConfirm: boolean;
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
}

// ── Definiciones de herramientas (para el system prompt del LLM) ──────────────
export const TOOL_DEFINITIONS = `
HERRAMIENTAS DISPONIBLES:
Puedes usar estas herramientas para ayudar al usuario. Para usarlas, incluye un bloque JSON especial en tu respuesta con este formato EXACTO:

\`\`\`tool
{"tool": "nombre_herramienta", "args": {"param1": "valor1"}}
\`\`\`

LISTA DE HERRAMIENTAS:

1. open_url — Sugerir al usuario abrir una página web (YouTube, Wikipedia, noticias, etc.)
   args: {"url": "https://...", "title": "Descripción del enlace"}
   Ejemplo: Buscar un video educativo o artículo relevante.

2. add_calendar_event — Crear un evento en el calendario personal del usuario.
   args: {"title": "Nombre del evento", "date": "YYYY-MM-DD", "start_time": "HH:MM", "end_time": "HH:MM"}
   Ejemplo: Agendar una sesión de estudio, un recordatorio de examen.

3. send_message — Enviar un mensaje a un amigo o grupo del usuario.
   args: {"recipient_name": "nombre del amigo o grupo", "content": "texto del mensaje"}
   Ejemplo: Enviar un saludo o recordatorio a un compañero.

4. search_library — Buscar materiales en la Biblioteca de Learn Up.
   args: {"query": "término de búsqueda"}
   Ejemplo: Encontrar documentos, PDFs o materiales educativos relevantes.

5. update_profile — Actualizar un campo del perfil del usuario.
   args: {"field": "bio|school|grade", "value": "nuevo valor"}
   Solo campos permitidos: bio, school, grade.

REGLAS PARA USAR HERRAMIENTAS:
- Solo usa una herramienta cuando el usuario lo pide explícita o implícitamente.
- NUNCA uses herramientas si el usuario solo quiere conversar o aprender.
- Si usas una herramienta, SIEMPRE acompáñala con texto explicativo.
- Puedes usar máximo 1 herramienta por mensaje.
- Las herramientas que modifican datos (calendario, mensajes, perfil) pedirán confirmación al usuario antes de ejecutarse.
- open_url también pide confirmación para que el navegador pueda abrirla.
- search_library se ejecuta automáticamente sin confirmación.
`;

// ── Herramientas que NO necesitan confirmación ────────────────────────────────
const AUTO_EXECUTE_TOOLS = ["search_library"];

// ── Parsear respuesta del LLM buscando tool calls ─────────────────────────────
export async function parseToolCall(response: string): Promise<{ cleanText: string; action: ToolAction | null }> {
  const toolMatch = response.match(/```tool\s*\n?([\s\S]*?)\n?```/);
  
  if (!toolMatch) {
    return { cleanText: response, action: null };
  }

  try {
    const toolJson = JSON.parse(toolMatch[1].trim());
    const toolName = toolJson.tool;
    const args = toolJson.args || {};

    // Limpiar el bloque tool del texto visible
    const cleanText = response.replace(/```tool\s*\n?[\s\S]*?\n?```/g, "").trim();

    const needsConfirm = !AUTO_EXECUTE_TOOLS.includes(toolName);

    const descriptions: Record<string, string> = {
      open_url: `Abrir: ${args.title || args.url}`,
      add_calendar_event: `Agregar evento "${args.title}" el ${args.date}`,
      send_message: `Enviar mensaje a ${args.recipient_name}`,
      search_library: `Buscar "${args.query}" en la Biblioteca`,
      update_profile: `Actualizar tu ${args.field}`,
    };

    return {
      cleanText,
      action: {
        tool: toolName,
        args,
        description: descriptions[toolName] || `Ejecutar ${toolName}`,
        requiresConfirm: needsConfirm,
      },
    };
  } catch (e) {
    console.error("Error parsing tool call:", e);
    return { cleanText: response, action: null };
  }
}

// ── Ejecutor de herramientas ──────────────────────────────────────────────────
export async function executeToolAction(
  tool: string,
  args: Record<string, any>,
): Promise<ToolResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "No estás autenticado." };
  }

  try {
    switch (tool) {
      // ── Abrir URL ───────────────────────────────────────────────────────
      case "open_url": {
        // La apertura real la hace el cliente. Aquí solo validamos.
        const url = args.url;
        if (!url || typeof url !== "string") {
          return { success: false, message: "URL no válida." };
        }
        return {
          success: true,
          message: `Abriendo: ${args.title || url}`,
          data: { url, title: args.title },
        };
      }

      // ── Agregar evento al calendario ────────────────────────────────────
      case "add_calendar_event": {
        const { title, date, start_time, end_time } = args;
        if (!title || !date) {
          return { success: false, message: "Faltan datos del evento (título y fecha son obligatorios)." };
        }

        const startDateTime = `${date}T${start_time || "09:00"}:00`;
        const endDateTime = `${date}T${end_time || "10:00"}:00`;

        // Buscar un calendario compartido del usuario o crear evento personal
        const { data: calendars } = await supabase
          .from("shared_calendars")
          .select("id, name")
          .filter("members", "cs", `{${user.id}}`)
          .limit(1);

        if (calendars && calendars.length > 0) {
          const calendarId = calendars[0].id;

          const { error } = await supabase
            .from("shared_calendar_events")
            .insert({
              calendar_id: calendarId,
              title,
              start_time: startDateTime,
              end_time: endDateTime,
              created_by: user.id,
            });

          if (error) {
            console.error("Error creating calendar event:", error);
            return { success: false, message: "Error al crear el evento." };
          }

          return {
            success: true,
            message: `✅ Evento "${title}" agregado al calendario "${calendars[0].name}" para el ${date}.`,
          };
        } else {
          return {
            success: false,
            message: "No tienes calendarios compartidos. Crea uno primero desde la sección de Calendario.",
          };
        }
      }

      // ── Enviar mensaje ──────────────────────────────────────────────────
      case "send_message": {
        const { recipient_name, content } = args;
        if (!recipient_name || !content) {
          return { success: false, message: "Faltan datos (destinatario y mensaje)." };
        }

        // Buscar al amigo por nombre o username
        const { data: friend } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .or(`full_name.ilike.%${recipient_name}%,username.ilike.%${recipient_name}%`)
          .neq("id", user.id)
          .limit(1)
          .maybeSingle();

        if (!friend) {
          return { success: false, message: `No encontré a "${recipient_name}" en tus contactos.` };
        }

        // Verificar que son amigos
        const { data: friendship } = await supabase
          .from("friendships")
          .select("id")
          .eq("status", "accepted")
          .or(
            `and(requester_id.eq.${user.id},addressee_id.eq.${friend.id}),and(requester_id.eq.${friend.id},addressee_id.eq.${user.id})`
          )
          .maybeSingle();

        if (!friendship) {
          return { success: false, message: `${friend.full_name} no está en tu lista de amigos.` };
        }

        // Buscar o crear sala privada
        const { data: rooms } = await supabase
          .from("chat_rooms")
          .select("id, participants, type")
          .eq("type", "private")
          .filter("participants", "cs", `{${user.id}}`);

        let roomId: string | null = null;
        if (rooms) {
          const existingRoom = rooms.find((r) => {
            const parts = Array.isArray(r.participants) ? r.participants : [];
            return parts.length === 2 && parts.includes(friend.id);
          });
          if (existingRoom) roomId = existingRoom.id;
        }

        if (!roomId) {
          const { data: newRoom, error: createErr } = await supabase
            .from("chat_rooms")
            .insert({
              type: "private",
              participants: [user.id, friend.id],
              updated_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (createErr || !newRoom) {
            return { success: false, message: "Error al crear la conversación." };
          }
          roomId = newRoom.id;
        }

        // Enviar mensaje
        const { error: msgErr } = await supabase
          .from("chat_messages")
          .insert({
            room_id: roomId,
            user_id: user.id,
            content,
          });

        if (msgErr) {
          return { success: false, message: "Error al enviar el mensaje." };
        }

        await supabase
          .from("chat_rooms")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", roomId);

        return {
          success: true,
          message: `✅ Mensaje enviado a ${friend.full_name}: "${content}"`,
        };
      }

      // ── Buscar en la biblioteca ─────────────────────────────────────────
      case "search_library": {
        const { query } = args;
        if (!query) {
          return { success: false, message: "Escribe qué quieres buscar." };
        }

        const { data: items, error } = await supabase
          .from("library_items")
          .select("id, title, description, subject, file_url, file_type")
          .eq("is_approved", true)
          .or(`title.ilike.%${query}%,description.ilike.%${query}%,subject.ilike.%${query}%`)
          .limit(5);

        if (error || !items || items.length === 0) {
          return {
            success: true,
            message: `No encontré materiales sobre "${query}" en la Biblioteca. Puedes subir tus propios materiales desde la sección Biblioteca.`,
          };
        }

        let result = `📚 Encontré ${items.length} material(es) sobre "${query}":\n\n`;
        items.forEach((item, i) => {
          result += `${i + 1}. **${item.title}**\n`;
          if (item.description) result += `   ${item.description}\n`;
          if (item.subject) result += `   📘 Materia: ${item.subject}\n`;
          result += `   📄 Tipo: ${item.file_type}\n`;
          result += `   🔗 [Ver archivo](${item.file_url})\n\n`;
        });

        return { success: true, message: result, data: items };
      }

      // ── Actualizar perfil ───────────────────────────────────────────────
      case "update_profile": {
        const { field, value } = args;
        const allowedFields = ["bio", "school", "grade"];

        if (!allowedFields.includes(field)) {
          return { success: false, message: `No puedo modificar el campo "${field}". Solo: ${allowedFields.join(", ")}.` };
        }

        const { error } = await supabase
          .from("profiles")
          .update({ [field]: value })
          .eq("id", user.id);

        if (error) {
          return { success: false, message: "Error al actualizar tu perfil." };
        }

        const fieldNames: Record<string, string> = {
          bio: "biografía",
          school: "escuela",
          grade: "grado",
        };

        return {
          success: true,
          message: `✅ Tu ${fieldNames[field] || field} se actualizó a: "${value}"`,
        };
      }

      default:
        return { success: false, message: `Herramienta "${tool}" no reconocida.` };
    }
  } catch (error: any) {
    console.error(`Error executing tool ${tool}:`, error);
    return { success: false, message: `Error al ejecutar la acción: ${error.message}` };
  }
}
