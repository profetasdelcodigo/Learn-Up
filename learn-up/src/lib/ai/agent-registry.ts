export type AiAgentId = "profesor" | "examenes" | "consejero" | "nutrirecetas" | "jarvis";

export interface AiToolDefinition {
  name: string;
  description: string;
  requiresConfirmation: boolean;
  externalEffect: boolean;
}

export interface AiAgentConfig {
  id: AiAgentId;
  name: string;
  purpose: string;
  safety: string[];
  tools: AiToolDefinition[];
}

export interface JarvisPermissionRequest {
  tool: string;
  reason: string;
  risk: "low" | "medium" | "high";
  summary: string;
}

const readOnlyTools: AiToolDefinition[] = [
  { name: "search_web", description: "Busca informacion publica actualizada.", requiresConfirmation: false, externalEffect: false },
  { name: "search_library", description: "Busca materiales aprobados en la biblioteca.", requiresConfirmation: false, externalEffect: false },
  { name: "search_documents", description: "Busca en documentos cargados por el usuario para RAG.", requiresConfirmation: false, externalEffect: false },
  { name: "query_repositories", description: "Consulta repositorios de conocimiento disponibles.", requiresConfirmation: false, externalEffect: false },
  { name: "browse_web_page", description: "Visita una URL especifica y extrae su contenido.", requiresConfirmation: false, externalEffect: false },
  { name: "trigger_academic_council", description: "Invoca el comité académico para evaluar un texto.", requiresConfirmation: false, externalEffect: false },
];

const writeTools: AiToolDefinition[] = [
  { name: "add_calendar_event", description: "Crea eventos o recordatorios en el calendario.", requiresConfirmation: true, externalEffect: true },
  { name: "send_message", description: "Envia mensajes a amigos, grupos o calendarios compartidos.", requiresConfirmation: true, externalEffect: true },
  { name: "generate_document", description: "Genera documentos editables o contenido estructurado.", requiresConfirmation: true, externalEffect: false },
  { name: "generate_image", description: "Genera imagenes mediante el proveedor multimedia configurado.", requiresConfirmation: true, externalEffect: false },
  { name: "create_exam", description: "Crea evaluaciones personalizadas.", requiresConfirmation: true, externalEffect: false },
  { name: "save_learned_concept", description: "Guarda conceptos aprendidos en el grafo.", requiresConfirmation: false, externalEffect: false },
];

export const AI_AGENT_REGISTRY: Record<AiAgentId, AiAgentConfig> = {
  profesor: {
    id: "profesor", name: "Profesor IA",
    purpose: "Tutor estilo NotebookLM: lee documentos del usuario, resume, cita fuentes, genera guias y conecta conceptos.",
    safety: ["No inventar citas. Si un documento no contiene la respuesta, decirlo.", "No acceder a archivos privados fuera de los documentos cargados.", "Separar explicacion, evidencia y ejercicios."],
    tools: [...readOnlyTools, ...writeTools],
  },
  examenes: {
    id: "examenes", name: "Examenes IA",
    purpose: "Genera examenes con dificultad, duracion, tipos de pregunta, rubrica y suma de 100 puntos.",
    safety: ["Mantener criterios de evaluacion claros.", "No filtrar respuestas si el modo practica pide solo preguntas.", "Validar que el puntaje total sea 100."],
    tools: [readOnlyTools[1], readOnlyTools[2], writeTools[4], writeTools[2]],
  },
  consejero: {
    id: "consejero", name: "Consejero IA",
    purpose: "Acompana al usuario con privacidad reforzada, respuestas empaticas y herramientas limitadas.",
    safety: ["No revelar conversaciones privadas de otros usuarios.", "No exponer secretos, tokens, claves ni datos sensibles.", "Para crisis o riesgo personal, recomendar apoyo humano inmediato.", "Toda accion externa requiere confirmacion."],
    tools: [readOnlyTools[0], writeTools[0], writeTools[1]],
  },
  nutrirecetas: {
    id: "nutrirecetas", name: "Nutrirecetas",
    purpose: "Crea recetas, analiza nutricion aproximada y busca imagenes relevantes cuando haya API disponible.",
    safety: ["No presentar informacion nutricional como diagnostico medico.", "Preguntar por alergias o restricciones si afectan la receta.", "Marcar valores nutricionales como aproximados."],
    tools: [readOnlyTools[0], writeTools[3], writeTools[2]],
  },
  jarvis: {
    id: "jarvis", name: "Jarvis",
    purpose: "Asistente orquestador de Learn Up. Entiende la necesidad del usuario y delega a herramientas o roles correspondientes.",
    safety: ["Si la pregunta es academica o de estudio, adopta el rol Profesor.", "Si es de organizacion o bienestar, adopta el rol Consejero y usa herramientas.", "Nunca asumas informacion privada que no este en el contexto inyectado.", "Las llamadas de herramientas son internas: nunca las muestres como codigo o JSON al usuario."],
    tools: [...readOnlyTools, ...writeTools],
  },
};

// The large skills catalogue is kept below for compatibility with existing skill prompts.
// Tool execution itself must always be validated against ToolSchemas and the real executor.
const SKILLS_CATALOG = `
═══════════════════════════════════════════════════════════════════════════════
📋 CATÁLOGO COMPLETO DE HABILIDADES Y HERRAMIENTAS DE LEARN UP
═══════════════════════════════════════════════════════════════════════════════
`;

export function buildAgentSystemPrompt(agentId: AiAgentId): string {
  const agent = AI_AGENT_REGISTRY[agentId];
  const tools = agent.tools.map(t => `- ${t.name}: ${t.description}`).join("\n");
  return `${SKILLS_CATALOG}\nEres ${agent.name}.\nPROPÓSITO: ${agent.purpose}\nREGLAS:\n${agent.safety.map(s => `- ${s}`).join("\n")}\n\nCAPACIDADES DISPONIBLES:\n${tools}\n\nLas herramientas se representan internamente de forma estructurada. Nunca escribas JSON, tool {...}, function_call ni payloads internos como respuesta visible.`;
}
