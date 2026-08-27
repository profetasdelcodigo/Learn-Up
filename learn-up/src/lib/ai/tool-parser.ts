import { AI_AGENT_REGISTRY } from "./agent-registry";
import { getToolDefinition, getToolSchema } from "./tool-contract";

export interface ParsedToolAction {
  tool: string;
  args: Record<string, any>;
  description: string;
  requiresConfirm: boolean;
}

const TOOL_ALIASES: Record<string, string> = {
  create_calendar_event: "add_calendar_event",
  create_group: "create_study_group",
  edit_group: "edit_group_info",
  react_to_message: "react_with_emoji",
  delete_message: "delete_sent_message",
  pin_message: "pin_important_message",
  create_poll: "create_chat_poll",
};

const DESCRIPTION_OVERRIDES: Record<string, (args: Record<string, any>) => string> = {
  open_url: a => `Abrir ${a.title || a.url || "la URL indicada"}`,
  add_calendar_event: a => `Crear el evento "${a.title || "Sin título"}" en tu calendario.`,
  delete_calendar_event: () => "Eliminar un evento de tu calendario.",
  add_habit: a => `Crear el hábito "${a.title || "Sin título"}".`,
  complete_habit_entry: a => `Marcar el hábito como completado${a.date ? ` el ${a.date}` : ""}.`,
  send_message: a => `Enviar un mensaje a ${a.recipient_name || "un contacto"}.`,
  generate_image: () => "Generar una imagen con IA.",
  generate_video: () => "Generar un vídeo con IA.",
  create_exam: a => `Crear un examen sobre "${a.topic || "el tema solicitado"}".`,
  read_professor_panel: () => "Consultar el panel académico del Profesor.",
  add_professor_formula: a => `Agregar la fórmula "${a.formula || ""}" al panel Fórmulas.`,
  add_professor_outline_item: a => `Agregar "${a.item || ""}" al esquema del Profesor.`,
  set_professor_document: a => `Vincular "${a.title || "este documento"}" al panel Docs.`,
  read_counselor_panel: () => "Consultar objetivos, ánimo y diario del Consejero.",
  add_counselor_goal: a => `Crear el objetivo "${a.text || ""}".`,
  toggle_counselor_goal: a => `Actualizar el objetivo "${a.text || ""}".`,
  set_counselor_mood: a => `Actualizar tu estado de ánimo a "${a.mood || ""}".`,
  save_counselor_journal: () => "Guardar una entrada en el Diario Emocional.",
  read_nutrition_panel: () => "Consultar el panel de Nutrirecetas.",
  set_nutrition_macros: () => "Actualizar los macros de la receta.",
  add_shopping_item: a => `Agregar "${a.name || "este ingrediente"}" a Compras.`,
  schedule_meal: a => `Programar "${a.meal || "la comida"}" para ${a.day || "el día indicado"}.`,
  set_recipe_panel: a => `Actualizar la receta "${a.name || ""}" en Nutrirecetas.`,
};

function allRegisteredTools() {
  return Object.values(AI_AGENT_REGISTRY).flatMap(agent => agent.tools);
}

function canonicalToolName(name: string) {
  return TOOL_ALIASES[name] || name;
}

function describeTool(name: string, args: Record<string, any>) {
  return DESCRIPTION_OVERRIDES[name]?.(args) || `Ejecutar ${name.replace(/_/g, " ")}.`;
}

function extractBalancedObject(source: string, start: number): string | null {
  const firstBrace = source.indexOf("{", start);
  if (firstBrace < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = firstBrace; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    if (ch === "}" && --depth === 0) return source.slice(firstBrace, i + 1);
  }
  return null;
}

function candidateObjects(response: string): string[] {
  const candidates: string[] = [];
  const markerRegex = /(?:tool_call|function_call|tool|function)\s*[:=]?/gi;
  let marker: RegExpExecArray | null;
  while ((marker = markerRegex.exec(response)) !== null) {
    const object = extractBalancedObject(response, marker.index + marker[0].length);
    if (object) candidates.push(object);
  }
  const standalone = /(^|\n)\s*(\{\s*"(?:tool|name|function|function_call)"\s*:\s*"[^"]+"[\s\S]*?\})/g;
  let match: RegExpExecArray | null;
  while ((match = standalone.exec(response)) !== null) candidates.push(match[2]);
  return [...new Set(candidates)];
}

function normalizeArguments(json: any): Record<string, any> {
  const args = json?.args ?? json?.arguments ?? json?.parameters ?? {};
  if (typeof args === "string") {
    try { const parsed = JSON.parse(args); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; }
  }
  return args && typeof args === "object" ? args : {};
}

function toolNameFromJson(json: any): string | null {
  const value = json?.tool ?? json?.name ?? json?.function ?? json?.function_call?.name;
  return typeof value === "string" ? value : null;
}

function stripToolSyntax(text: string): string {
  return text
    .replace(/```(?:tool|json|javascript|js|typescript)?\s*\n?[\s\S]*?```/gi, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<function_call>[\s\S]*?<\/function_call>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/^\s*tool\s*\(\s*\{[\s\S]*?\}\s*\)\s*$/gim, "")
    .replace(/^\s*\{\s*"(?:tool|name|function|function_call)"\s*:\s*"[^"]+"[\s\S]*?\}\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseToolCalls(response: string): { cleanText: string; actions: ParsedToolAction[] } {
  const actions: ParsedToolAction[] = [];
  for (const candidate of candidateObjects(response)) {
    try {
      const parsed = JSON.parse(candidate);
      const rawName = toolNameFromJson(parsed);
      const toolName = rawName ? canonicalToolName(rawName) : null;
      if (!toolName) continue;
      const schema = getToolSchema(toolName);
      if (!schema) continue;
      const validation = schema.safeParse(normalizeArguments(parsed));
      if (!validation.success) {
        console.warn(`[TOOLS] Argumentos inválidos para ${toolName}`);
        continue;
      }
      const args = validation.data as Record<string, any>;
      const definition = getToolDefinition(toolName);
      if (!definition) continue;
      if (!actions.some(a => a.tool === toolName && JSON.stringify(a.args) === JSON.stringify(args))) {
        actions.push({
          tool: toolName,
          args,
          description: describeTool(toolName, args),
          requiresConfirm: definition.requiresConfirmation,
        });
      }
    } catch {
      // ignore malformed candidates
    }
  }
  return { cleanText: stripToolSyntax(response), actions };
}
