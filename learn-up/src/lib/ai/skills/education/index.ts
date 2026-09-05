import { z } from "zod";
import { Skill, ToolDefinition } from "../../core/types";

// Helper for AI-driven educational generation
async function generateEduContentWithAI(prompt: string, title: string) {
  const { getAICompletion } = await import("@/lib/ai");
  const content = await getAICompletion([{ role: "user", content: prompt }], "gemini-2.0-flash");
  return { success: true, message: `${title} completado exitosamente.`, data: { title, content } };
}

// 176. solve_math_step_by_step
export const solveMathStepByStepTool: ToolDefinition = {
  id: "solve_math_step_by_step",
  category: "education",
  description: "Resolver problema matemático mostrando cada paso.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ problem: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Resuelve el siguiente problema matemático detallando paso a paso tu razonamiento y el procedimiento algebraico: ${args.problem}`, `Solución Matemática`)
};

// 177. graph_math_function
export const graphMathFunctionTool: ToolDefinition = {
  id: "graph_math_function",
  category: "education",
  description: "Instrucciones para graficar función con dominio, rango, intersecciones.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ equation: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Analiza la función matemática f(x) = ${args.equation}. Determina el dominio, rango, intersecciones con los ejes x e y, asíntotas, y describe cómo se vería la gráfica.`, `Gráfica Analítica: ${args.equation}`)
};

// 178. verify_calculus_solution
export const verifyCalculusSolutionTool: ToolDefinition = {
  id: "verify_calculus_solution",
  category: "education",
  description: "Verificar derivada/integral del estudiante.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ student_solution: z.string(), original_problem: z.string() }),
  execute: async (args) => generateEduContentWithAI(`El estudiante resolvió el problema de cálculo "${args.original_problem}" con esta solución: "${args.student_solution}". Verifica si es correcta. Si hay un error, indica en qué paso falló sin darle directamente la respuesta final, para que aprenda.`, `Verificación de Cálculo`)
};

// 179. balance_chemical_equation
export const balanceChemicalEquationTool: ToolDefinition = {
  id: "balance_chemical_equation",
  category: "education",
  description: "Balancear ecuación química con procedimiento.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ equation: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Balancea la siguiente ecuación química paso a paso, explicando el método (tanteo o redox): ${args.equation}`, `Balanceo Químico`)
};

// 180. analyze_literary_text
export const analyzeLiteraryTextTool: ToolDefinition = {
  id: "analyze_literary_text",
  category: "education",
  description: "Figuras retóricas, tema, tesis, contexto histórico.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ text: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Realiza un análisis literario del siguiente fragmento. Identifica figuras retóricas, el tema central, y el tono general.\n\n${args.text}`, `Análisis Literario`)
};

// 181. conjugate_verb
export const conjugateVerbTool: ToolDefinition = {
  id: "conjugate_verb",
  category: "education",
  description: "Conjugar verbo en cualquier idioma/tiempo/persona.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ verb: z.string(), language: z.string(), tense: z.string().optional().default("todos") }),
  execute: async (args) => generateEduContentWithAI(`Conjuga el verbo "${args.verb}" en el idioma ${args.language} para el tiempo verbal: ${args.tense}. Proporciona la conjugación completa en formato tabla.`, `Conjugación: ${args.verb}`)
};

// 182. translate_with_explanation
export const translateWithExplanationTool: ToolDefinition = {
  id: "translate_with_explanation",
  category: "education",
  description: "Traducir con notas sobre matices y falsos cognados.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ text: z.string(), source: z.string().optional(), target: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Traduce el siguiente texto al ${args.target} (desde ${args.source || "detectado"}). Después de la traducción, explica cualquier falso cognado, modismo local o matiz cultural importante de la traducción:\n${args.text}`, `Traducción Explicada`)
};

// 183. practice_language_vocabulary
export const practiceLanguageVocabularyTool: ToolDefinition = {
  id: "practice_language_vocabulary",
  category: "education",
  description: "Flash de vocabulario en idioma objetivo.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ language: z.string(), level: z.string().optional().default("intermedio") }),
  execute: async (args) => generateEduContentWithAI(`Genera una lista de 10 palabras de vocabulario clave en ${args.language} de nivel ${args.level}. Incluye para cada palabra: traducción al español, pronunciación fonética aproximada y una oración de ejemplo.`, `Práctica: ${args.language}`)
};

// 184. solve_physics_problem
export const solvePhysicsProblemTool: ToolDefinition = {
  id: "solve_physics_problem",
  category: "education",
  description: "Resolver con leyes, ecuaciones, diagrama de cuerpo libre.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ problem: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Resuelve el siguiente problema de física: "${args.problem}". Detalla los datos iniciales, la ley o fórmula a aplicar, y el procedimiento paso a paso. Describe verbalmente el diagrama de cuerpo libre si aplica.`, `Física: Solución`)
};

// 185. analyze_statistical_data
export const analyzeStatisticalDataTool: ToolDefinition = {
  id: "analyze_statistical_data",
  category: "education",
  description: "Media, mediana, moda, desviación, correlaciones.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ data: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Analiza el siguiente conjunto de datos estadísticos: ${args.data}. Calcula e interpreta la media, mediana, moda y describe su distribución.`, `Análisis Estadístico`)
};

// 186. generate_historical_timeline
export const generateHistoricalTimelineTool: ToolDefinition = {
  id: "generate_historical_timeline",
  category: "education",
  description: "Línea de tiempo con eventos, fechas, actores.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ period: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Crea una línea de tiempo detallada sobre el periodo histórico: "${args.period}". Resalta fechas clave, actores principales y consecuencias de los eventos.`, `Línea de Tiempo: ${args.period}`)
};

// 187. explain_with_analogy
export const explainWithAnalogyTool: ToolDefinition = {
  id: "explain_with_analogy",
  category: "education",
  description: "Explicar concepto difícil con analogía adaptada al nivel.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ concept: z.string(), level: z.string().optional().default("secundaria") }),
  execute: async (args) => generateEduContentWithAI(`Explica el concepto complejo "${args.concept}" para un estudiante de nivel "${args.level}". Usa una analogía creativa y fácil de entender de la vida cotidiana.`, `Analogía: ${args.concept}`)
};

// 188. generate_practice_problems
export const generateEduPracticeProblemsTool: ToolDefinition = {
  id: "generate_edu_practice_problems",
  category: "education",
  description: "5-20 problemas con soluciones detalladas.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ subject: z.string(), difficulty: z.string().optional().default("intermedio"), count: z.number().optional().default(10) }),
  execute: async (args) => generateEduContentWithAI(`Genera ${args.count} problemas de práctica sobre ${args.subject} de nivel ${args.difficulty}. Al final, proporciona la solución detallada de cada problema.`, `Problemas: ${args.subject}`)
};

// 189. prepare_standardized_test
export const prepareStandardizedTestTool: ToolDefinition = {
  id: "prepare_standardized_test",
  category: "education",
  description: "Simulacro SAT/TOEFL/PAA con estrategias por sección.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ test_name: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Proporciona una guía rápida y un mini-simulacro de preparación para el examen estandarizado "${args.test_name}". Incluye estrategias por cada sección clave y 5 preguntas de ejemplo con explicaciones.`, `Preparación: ${args.test_name}`)
};

// 190. solve_programming_challenge
export const solveProgrammingChallengeTool: ToolDefinition = {
  id: "solve_programming_challenge",
  category: "education",
  description: "Resolver reto de código con explicación y complejidad.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ challenge: z.string(), language: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Resuelve el siguiente reto de programación en ${args.language}:\n${args.challenge}\nExplica paso a paso tu lógica, y analiza la complejidad temporal (Big O) y espacial de tu solución.`, `Reto: Programación`)
};

// 191. analyze_artwork
export const analyzeArtworkTool: ToolDefinition = {
  id: "analyze_artwork",
  category: "education",
  description: "Estilo, período, técnica, simbolismo, contexto histórico.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ artwork_name: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Analiza la obra de arte "${args.artwork_name}". Detalla su estilo, técnica, autor, período histórico, el simbolismo de la composición y su impacto cultural.`, `Arte: ${args.artwork_name}`)
};

// 192. explain_scientific_phenomenon
export const explainScientificPhenomenonTool: ToolDefinition = {
  id: "explain_scientific_phenomenon",
  category: "education",
  description: "Explicación rigurosa con analogías y ejemplos.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ phenomenon: z.string() }),
  execute: async (args) => generateEduContentWithAI(`Explica el fenómeno científico "${args.phenomenon}" con rigor académico, pero utilizando ejemplos reales y aplicaciones prácticas para que sea memorable.`, `Ciencia: ${args.phenomenon}`)
};

// 193. socratic_debate
export const socraticDebateTool: ToolDefinition = {
  id: "socratic_debate",
  category: "education",
  description: "Diálogo socrático con preguntas progresivas.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ topic: z.string() }),
  execute: async (args) => {
    return {
      success: true,
      message: "Modo debate Socrático activado.",
      data: { instruction: `Asume el rol de Sócrates. El usuario quiere debatir sobre "${args.topic}". Inicia la conversación con una sola pregunta profunda y abierta para desafiar sus suposiciones iniciales, y espera su respuesta.` }
    };
  }
};

// 194. language_speaking_practice
export const languageSpeakingPracticeTool: ToolDefinition = {
  id: "language_speaking_practice",
  category: "education",
  description: "Práctica conversacional en idioma con correcciones.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ language: z.string() }),
  execute: async (args) => {
    return {
      success: true,
      message: "Modo práctica conversacional activado.",
      data: { instruction: `Vamos a practicar conversación en ${args.language}. Habla completamente en ${args.language}, corrige amablemente los errores del usuario al final de cada turno, y haz preguntas para mantener la charla viva.` }
    };
  }
};

// 195. solve_multivariable_equation
export const solveMultivariableEquationTool: ToolDefinition = {
  id: "solve_multivariable_equation",
  category: "education",
  description: "Gauss-Jordan, Cramer o sustitución paso a paso.",
  risk: "read",
  requiresConfirmation: false,
  supportsAutopilot: true,
  schema: z.object({ equations: z.array(z.string()) }),
  execute: async (args) => generateEduContentWithAI(`Resuelve el siguiente sistema de ecuaciones lineales multivariable paso a paso: ${args.equations.join(", ")}. Muestra el procedimiento claramente usando el método más adecuado (Sustitución, Cramer o Gauss-Jordan).`, `Sistema Ecuaciones`)
};

export const educationSkill: Skill = {
  id: "education",
  name: "Educación Especializada",
  category: "education",
  description: "Solución paso a paso de matemáticas, ciencias, programación, historia e idiomas.",
  tools: [
    solveMathStepByStepTool, graphMathFunctionTool, verifyCalculusSolutionTool,
    balanceChemicalEquationTool, analyzeLiteraryTextTool, conjugateVerbTool,
    translateWithExplanationTool, practiceLanguageVocabularyTool, solvePhysicsProblemTool,
    analyzeStatisticalDataTool, generateHistoricalTimelineTool, explainWithAnalogyTool,
    generateEduPracticeProblemsTool, prepareStandardizedTestTool, solveProgrammingChallengeTool,
    analyzeArtworkTool, explainScientificPhenomenonTool, socraticDebateTool,
    languageSpeakingPracticeTool, solveMultivariableEquationTool
  ]
};
