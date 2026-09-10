import { z } from "zod";
import type { Skill, ToolDefinition } from "../core/types";
import { getAICompletion, AI_MODELS } from "@/lib/ai";

async function jsonCompletion(prompt: string) {
  const result = await getAICompletion([{ role: "user", content: prompt }], AI_MODELS.openRouterResearch.id, true);
  const raw = String(result?.choices?.[0]?.message?.content || "").trim();
  if (!raw) throw new Error("La IA no devolvió datos estructurados.");
  try { return JSON.parse(raw); } catch { const block = raw.match(/\{[\s\S]*\}/)?.[0]; if (block) return JSON.parse(block); throw new Error("No se pudo interpretar el resultado estructurado."); }
}

const graphFunction: ToolDefinition = {
  id: "graph_math_function", category: "education", description: "Analiza una función y devuelve puntos de muestreo estructurados para representar su gráfica.", risk: "read", requiresConfirmation: false, supportsAutopilot: true,
  schema: z.object({ equation: z.string().min(1), x_values: z.array(z.number()).min(3).max(30).optional() }),
  execute: async ({ equation, x_values }) => { const xs = x_values?.length ? x_values : [-5,-4,-3,-2,-1,0,1,2,3,4,5]; const data = await jsonCompletion(`Analiza f(x)=${equation}. Calcula valores exactos o razonablemente precisos para estos x: ${xs.join(", ")}. Devuelve SOLO JSON: {domain:string,range:string,intercepts_x:string[],intercept_y:string,asymptotes:string[],points:[{x:number,y:number}]} . Si una operación no está definida en un punto, omite ese punto. No inventes propiedades que no se puedan determinar.`); return { success:true,message:"Función analizada y puntos de gráfica calculados.",data:{equation, ...data, model:AI_MODELS.openRouterResearch.id} }; },
};

export function withFinalEducationOverrides(skill: Skill): Skill {
  if (skill.id !== "education") return skill;
  return { ...skill, tools: skill.tools.map(tool => tool.id === graphFunction.id ? graphFunction : tool) };
}
