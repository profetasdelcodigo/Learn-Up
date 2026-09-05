import { describe, expect, it } from "vitest";
import { aiRegistry } from "../skills";
import { shouldExecuteTool } from "../tool-contract";

const EXPECTED: Record<string,number>={calendar:27,chat:25,library:22,"knowledge-graph":15,content_generation:22,multimedia:15,research:18,analytics:14,social:17,education:20};

describe("Learn Up skill registry",()=>{
 it("registers all 10 packs with specified counts",()=>{const skills=aiRegistry.getAllSkills();expect(skills).toHaveLength(10);for(const[id,count]of Object.entries(EXPECTED)){const skill=aiRegistry.getSkill(id);expect(skill,`Missing skill ${id}`).toBeDefined();expect(skill!.tools).toHaveLength(count);}});
 it("has no duplicate tool ids",()=>{const ids=aiRegistry.getAllTools().map(t=>t.id);expect(new Set(ids).size).toBe(ids.length);});
 it("has execute implementation for every registered tool",()=>{for(const tool of aiRegistry.getAllTools())expect(typeof tool.execute,`Tool ${tool.id} has no execute implementation`).toBe("function");});
 it("forces confirmation and disables autopilot for destructive registered tools",()=>{for(const tool of aiRegistry.getAllTools())if(tool.risk==="destructive"){expect(tool.requiresConfirmation).toBe(true);expect(tool.supportsAutopilot).toBe(false);}});
 it("matches registered tool autopilot policy",()=>{for(const tool of aiRegistry.getAllTools()){const decision=shouldExecuteTool(tool.id,"autopilot",true);if(tool.supportsAutopilot&&!tool.requiresConfirmation){expect(decision).toBe("execute");}else if(tool.requiresConfirmation||tool.risk==="destructive"){expect(decision).toBe("pending_confirmation");}}});
 it("respects manual confirmation policy",()=>{for(const tool of aiRegistry.getAllTools())if(tool.requiresConfirmation)expect(shouldExecuteTool(tool.id,"manual",true)).toBe("pending_confirmation");});
 it("keeps right-panel writes behind confirmation manually and automatic in autopilot",()=>{for(const name of ["add_advisor_goal","complete_advisor_goal","log_advisor_mood","add_advisor_journal_entry","save_nutrition_recipe","add_nutrition_shopping_item","set_nutrition_week_plan"]){expect(shouldExecuteTool(name,"manual",true)).toBe("pending_confirmation");expect(shouldExecuteTool(name,"autopilot",true)).toBe("execute");}});
});
