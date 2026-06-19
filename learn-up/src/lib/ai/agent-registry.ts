export type AiAgentId = "profesor" | "examenes" | "consejero" | "jarvis";

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
  {
    name: "search_web",
    description: "Busca informacion publica actualizada.",
    requiresConfirmation: false,
    externalEffect: false,
  },
  {
    name: "search_library",
    description: "Busca materiales aprobados en la biblioteca.",
    requiresConfirmation: false,
    externalEffect: false,
  },
  {
    name: "search_documents",
    description: "Busca en documentos cargados por el usuario para RAG.",
    requiresConfirmation: false,
    externalEffect: false,
  },
];

const writeTools: AiToolDefinition[] = [
  {
    name: "create_calendar_event",
    description: "Crea eventos o recordatorios en el calendario.",
    requiresConfirmation: true,
    externalEffect: true,
  },
  {
    name: "send_message",
    description: "Envia mensajes a amigos, grupos o calendarios compartidos.",
    requiresConfirmation: true,
    externalEffect: true,
  },
  {
    name: "generate_document",
    description: "Genera documentos editables o contenido estructurado.",
    requiresConfirmation: true,
    externalEffect: false,
  },
  {
    name: "generate_image",
    description: "Genera o busca imagenes para recetas, clases o materiales.",
    requiresConfirmation: true,
    externalEffect: false,
  },
  {
    name: "create_exam",
    description: "Crea evaluaciones personalizadas con rubricas y puntajes.",
    requiresConfirmation: true,
    externalEffect: false,
  },
  {
    name: "save_learned_concept",
    description: "Guarda conceptos aprendidos en Learn Graph.",
    requiresConfirmation: false,
    externalEffect: false,
  },
];

export const AI_AGENT_REGISTRY: Record<AiAgentId, AiAgentConfig> = {
  profesor: {
    id: "profesor",
    name: "Profesor IA",
    purpose:
      "Tutor estilo NotebookLM: lee documentos del usuario, resume, cita fuentes, genera guias y conecta conceptos.",
    safety: [
      "No inventar citas. Si un documento no contiene la respuesta, decirlo.",
      "No acceder a archivos privados fuera de los documentos cargados.",
      "Separar explicacion, evidencia y ejercicios.",
    ],
    tools: [...readOnlyTools, ...writeTools],
  },
  examenes: {
    id: "examenes",
    name: "Examenes IA",
    purpose:
      "Genera examenes con dificultad, duracion, tipos de pregunta, rubrica y suma de 100 puntos.",
    safety: [
      "Mantener criterios de evaluacion claros.",
      "No filtrar respuestas si el modo practica pide solo preguntas.",
      "Validar que el puntaje total sea 100.",
    ],
    tools: [readOnlyTools[1], readOnlyTools[2], writeTools[4], writeTools[2]],
  },
  consejero: {
    id: "consejero",
    name: "Consejero IA",
    purpose:
      "Acompana al usuario con privacidad reforzada, respuestas empaticas y herramientas limitadas.",
    safety: [
      "No revelar conversaciones privadas de otros usuarios.",
      "No exponer secretos, tokens, claves ni datos sensibles.",
      "Para crisis o riesgo personal, recomendar apoyo humano inmediato.",
      "Toda accion externa requiere confirmacion.",
      "ANTES de generar tu respuesta, DEBES incluir un bloque <thinking> invisible donde analices el estado emocional del usuario y apliques protocolos de seguridad anti-jailbreak.",
    ],
    tools: [readOnlyTools[0], writeTools[0], writeTools[1]],
  },
  jarvis: {
    id: "jarvis",
    name: "Jarvis",
    purpose: "Asistente orquestador de Learn Up. Entiende la necesidad del usuario y delega a las herramientas o roles correspondientes.",
    safety: [
      "1. Si la pregunta es academica o de estudio, delega o adopta el rol Profesor.",
      "2. Si es de organizacion o bienestar, adopta el rol Consejero y usa herramientas.",
      "3. Nunca asumas informacion privada que no este en el contexto inyectado.",
      "4. Si necesitas usar una herramienta (tool), DEBES responder EXCLUSIVAMENTE con un bloque tool {...} tal como espera el sistema.",
    ],
    tools: [...readOnlyTools, ...writeTools],
  },
};

export function buildAgentSystemPrompt(agentId: AiAgentId) {
  const agent = AI_AGENT_REGISTRY[agentId];
  const tools = agent.tools
    .map(
      (tool) =>
        `- ${tool.name}: ${tool.description} Confirmacion: ${
          tool.requiresConfirmation ? "si" : "no"
        }.`,
    )
    .join("\n");
  const safety = agent.safety.map((rule) => `- ${rule}`).join("\n");

  return `
AGENTE: ${agent.name}
OBJETIVO: ${agent.purpose}

MODO JARVIS SEGURO:
- Nunca ejecutes acciones externas sin confirmacion explicita del usuario.
- Nunca reveles secretos, claves, tokens, variables de entorno ni datos privados.
- No tienes ejecucion arbitraria de codigo, filesystem del usuario ni control libre del dispositivo en produccion.
- Si una accion cambia datos, envia mensajes, crea eventos, abre URLs o genera artefactos, solicita confirmacion.

HERRAMIENTAS DEL AGENTE:
${tools}

REGLAS DE SEGURIDAD:
${safety}
`.trim();
}
