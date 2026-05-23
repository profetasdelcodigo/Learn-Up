import { createClient } from "@/utils/supabase/server";
import { ensurePrivateRoom, sendMessage } from "@/actions/chat";
import { performWebSearch } from "@/lib/web-search";
import { findRelatedConcepts, linkConcepts } from "@/lib/knowledge-graph";

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

6. add_habit — Crear un nuevo hábito en el Habit Tracker del usuario.
   args: {"title": "Nombre del hábito"}
   Ejemplo: Leer 20 páginas diarias, Tomar agua.

7. search_web — Buscar información actualizada en internet en tiempo real.
   args: {"query": "término de búsqueda específico"}
   Ejemplo: Últimas noticias, datos históricos, descubrimientos científicos recientes.

8. save_learned_concept — Guardar silenciosamente un concepto importante que el estudiante acaba de comprender en su "Learn Graph" (memoria a largo plazo).
   args: {"title": "Nombre del concepto", "description": "Breve resumen de lo que el estudiante comprendió"}
   Ejemplo: Guardar "Mitocondria" cuando el estudiante por fin entiende su función.

REGLAS ESTRICTAS PARA USAR HERRAMIENTAS:
- NO uses herramientas (ni investigues en internet) si el usuario solo dice "Hola", "Buenos días", o hace comentarios casuales. Responde de forma natural y rápida.
- Solo usa una herramienta cuando el usuario lo pide explícita o implícitamente de forma clara.
- NUNCA uses herramientas si el usuario solo quiere conversar o aprender conceptos.
- Si usas una herramienta, SIEMPRE acompáñala con texto explicativo.
- Puedes usar máximo 1 herramienta por mensaje.
- Las herramientas que modifican datos (calendario, mensajes, perfil, hábitos) pedirán confirmación al usuario antes de ejecutarse.
- open_url también pide confirmación para que el navegador pueda abrirla.
- search_library se ejecuta automáticamente sin confirmación.
`;

// ── Herramientas que NO necesitan confirmación ────────────────────────────────
const AUTO_EXECUTE_TOOLS = ["search_library", "search_web", "save_learned_concept"];

// ── Parsear respuesta del LLM buscando tool calls ─────────────────────────────
export async function parseToolCall(response: string): Promise<{ cleanText: string; action: ToolAction | null }> {
  // Regex corregido para capturar el bloque JSON de herramientas y eliminarlo del texto
  const toolRegex = /```tool\s*\n?([\s\S]*?)\n?```/g;
  let cleanText = response;
  let action: ToolAction | null = null;

  const match = toolRegex.exec(response);
  if (match) {
    try {
      const toolJson = JSON.parse(match[1].trim());
      const toolName = toolJson.tool;
      const args = toolJson.args || {};

      const needsConfirm = !AUTO_EXECUTE_TOOLS.includes(toolName);

      const descriptions: Record<string, string> = {
        open_url: `¿Quieres abrir ${args.title}?`,
        add_calendar_event: `¿Agendar "${args.title}" para el ${args.date}?`,
        send_message: `¿Enviar mensaje a ${args.recipient_name}?`,
        search_library: `Buscando en la biblioteca...`,
        update_profile: `¿Actualizar tu ${args.field} a "${args.value}"?`,
        add_habit: `¿Añadir el hábito "${args.title}"?`,
        search_web: `Investigando en internet...`,
        save_learned_concept: `Guardando concepto en tu mapa mental...`,
      };

      action = {
        tool: toolName,
        args,
        description: descriptions[toolName] || `Ejecutar ${toolName}`,
        requiresConfirm: needsConfirm,
      };

      // Limpiar el texto: quitar el bloque tool
      cleanText = response.replace(match[0], "").trim();
    } catch (e) {
      console.error("Error parsing tool call:", e);
    }
  }

  return { cleanText, action };
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

        const { error } = await supabase
          .from("calendar_events")
          .insert({
            user_id: user.id,
            title,
            start_time: startDateTime,
            end_time: endDateTime,
          });

        if (error) {
          console.error("Error creating calendar event:", error);
          return { success: false, message: "Error al crear el evento." };
        }

        return {
          success: true,
          message: `✅ Evento "${title}" agregado a tu calendario personal para el ${date}.`,
        };
      }

      // ── Enviar mensaje ──────────────────────────────────────────────────
      case "send_message": {
        const { recipient_name, content } = args;
        if (!recipient_name || !content) {
          return { success: false, message: "Faltan datos (destinatario y mensaje)." };
        }

        const cleanRecipient = recipient_name.replace(/^@/, '');

        // 1. Buscar en Calendarios Compartidos
        const { data: sharedCals } = await supabase
          .from("shared_calendars")
          .select("id, name")
          .filter("members", "cs", `{${user.id}}`)
          .ilike("name", `%${cleanRecipient}%`)
          .limit(5);

        if (sharedCals && sharedCals.length > 0) {
          if (sharedCals.length > 1) {
            const options = sharedCals.map((c: any, i: number) => `${i + 1}) ${c.name}`).join(", ");
            return { 
              success: false, 
              message: `He encontrado varios calendarios con ese nombre: ${options}. ¿A cuál te refieres?` 
            };
          }
          const cal = sharedCals[0];
          const { error } = await supabase
            .from("shared_calendar_messages")
            .insert({
              calendar_id: cal.id,
              user_id: user.id,
              content,
              type: "text",
            });
          if (error) {
            console.error(error);
            return { success: false, message: "Error al enviar el mensaje al calendario." };
          }
          return { success: true, message: `✅ Mensaje enviado al calendario "${cal.name}".` };
        }

        // 2. Buscar en Grupos de Aprendamos Juntos (chat_rooms)
        const { data: userRooms } = await supabase
          .from("chat_rooms")
          .select("id, name, participants")
          .eq("type", "group")
          .ilike("name", `%${cleanRecipient}%`)
          .limit(5);
          
        const myRooms = userRooms?.filter((r: any) => {
          const parts = Array.isArray(r.participants) ? r.participants : JSON.parse(r.participants || "[]");
          return parts.includes(user.id);
        });

        if (myRooms && myRooms.length > 0) {
          if (myRooms.length > 1) {
            const options = myRooms.map((r: any, i: number) => `${i + 1}) ${r.name}`).join(", ");
            return { 
              success: false, 
              message: `He encontrado varios grupos con ese nombre: ${options}. ¿A cuál quieres enviar el mensaje?` 
            };
          }
          const myRoom = myRooms[0];
          const { error } = await supabase
            .from("chat_messages")
            .insert({
              room_id: myRoom.id,
              user_id: user.id,
              content,
            });
          if (error) return { success: false, message: "Error al enviar el mensaje al grupo." };
          await supabase.from("chat_rooms").update({ updated_at: new Date().toISOString() }).eq("id", myRoom.id);
          return { success: true, message: `✅ Mensaje enviado al grupo "${myRoom.name}".` };
        }

        // 3. Buscar en Amigos (solo los que tienen amistad aceptada)
        const { data: friendships } = await supabase
          .from("friendships")
          .select("requester_id, addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
          
        if (friendships && friendships.length > 0) {
          const friendIds = friendships.map((f: any) =>
            f.requester_id === user.id ? f.addressee_id : f.requester_id
          );
          
          const cleanRecipient = recipient_name.replace(/^@/, '');
          const { data: friendProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, username")
            .in("id", friendIds)
            .or(`full_name.ilike.%${cleanRecipient}%,username.ilike.%${cleanRecipient}%`)
            .limit(5);
            
          if (friendProfiles && friendProfiles.length > 0) {
            if (friendProfiles.length > 1) {
              const options = friendProfiles.map((p: any, i: number) => `${i + 1}) ${p.full_name} (@${p.username})`).join(", ");
              return { 
                success: false, 
                message: `He encontrado varios amigos que coinciden: ${options}. ¿A quién se lo envío? (puedes usar el @usuario para ser exacto)` 
              };
            }
            const friend = friendProfiles[0];
            try {
              const roomId = await ensurePrivateRoom(friend.id);
              await sendMessage(roomId, content);
              
              return {
                success: true,
                message: `✅ Mensaje enviado a ${friend.full_name}: "${content}"`,
              };
            } catch (error: any) {
              console.error("Error sending message tool:", error);
              return { success: false, message: "Error al enviar el mensaje directo." };
            }
          }
        }

        return { success: false, message: `No encontré ningún calendario, grupo o amigo llamado "${recipient_name}".` };
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

      // ── Agregar Hábito ───────────────────────────────────────────────
      case "add_habit": {
        const { title } = args;
        if (!title) return { success: false, message: "Falta el nombre del hábito." };

        const { error } = await supabase
          .from("habits")
          .insert({
            user_id: user.id,
            title,
            streak: 0,
            completed_dates: [],
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.error("Error creating habit:", error);
          return { success: false, message: "Error al crear el hábito." };
        }

        return {
          success: true,
          message: `✅ Hábito "${title}" añadido exitosamente a tu Habit Tracker.`,
        };
      }

      // ── Buscar en la web ───────────────────────────────────────────────
      case "search_web": {
        const { query } = args;
        if (!query) return { success: false, message: "No especificaste qué buscar." };

        try {
          const results = await performWebSearch(query, 3);
          return {
            success: true,
            message: `Resultados de la web para "${query}":\n\n${results}`,
          };
        } catch (e) {
          console.error("Error searching web:", e);
          return { success: false, message: "Hubo un error al buscar en internet." };
        }
      }

      // ── Guardar Concepto en Learn Graph ───────────────────────────────
      case "save_learned_concept": {
        const { title, description } = args;
        if (!title) return { success: false, message: "El concepto debe tener un título." };

        try {
          const { getAIEmbedding } = await import("@/lib/ai");
          const embedding = await getAIEmbedding(`Título: ${title}\nDescripción: ${description || ""}`);

          const { data: newNode, error } = await supabase
            .from("knowledge_nodes")
            .insert({
              user_id: user.id,
              title,
              description: description || "",
              embedding: `[${embedding.join(',')}]`,
              source_type: "chat_ia"
            })
            .select("id")
            .single();

          if (error) {
            console.error("Error saving knowledge node:", error);
            return { success: false, message: "Hubo un error al guardar el concepto en tu grafo de conocimiento." };
          }

          // Auto-link to related existing concepts
          let linkedCount = 0;
          if (newNode?.id) {
            try {
              const related = await findRelatedConcepts(user.id, `${title} ${description || ""}`, 3, 0.55);
              const otherNodes = related.filter(n => n.id !== newNode.id);
              for (const node of otherNodes) {
                const linked = await linkConcepts(user.id, newNode.id, node.id, "related_to");
                if (linked) linkedCount++;
              }
            } catch (linkErr) {
              console.error("Auto-linking failed (non-critical):", linkErr);
            }
          }

          const linkMsg = linkedCount > 0
            ? ` y lo conecté con ${linkedCount} concepto(s) relacionado(s)`
            : "";

          return {
            success: true,
            message: `🧠 He guardado silenciosamente el concepto "${title}" en tu mapa de conocimiento a largo plazo (Learn Graph)${linkMsg}.`,
          };
        } catch (e) {
          console.error("Error generating embedding:", e);
          return { success: false, message: "Error al procesar el conocimiento." };
        }
      }

      default:
        return { success: false, message: `Herramienta "${tool}" no reconocida.` };
    }
  } catch (error: any) {
    console.error(`Error executing tool ${tool}:`, error);
    return { success: false, message: `Error al ejecutar la acción: ${error.message}` };
  }
}
