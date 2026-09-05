import { tool } from "ai";
import { z } from "zod";
import { aiRegistry } from "./skills";
import { AiToolDefinition } from "./agent-registry";
import { materializeToolResult } from "./core/materialize-result";
import { panelTools } from "./core/panel-tools";

const PACK_TO_SKILL: Record<string,string> = {
  calendar_pack:"calendar", chat_pack:"chat", library_pack:"library", learning_pack:"knowledge-graph", content_pack:"content_generation", media_pack:"multimedia", research_pack:"research", stats_pack:"analytics", profile_pack:"social", edu_pack:"education"
};
const ALL_PACKS=Object.keys(PACK_TO_SKILL);
function selectedRegistryTools(activeSkills:string[]=[]){const requested=activeSkills.length?activeSkills:ALL_PACKS;const ids=new Set(requested.map(id=>PACK_TO_SKILL[id]||id));return aiRegistry.getAllSkills().filter(skill=>ids.has(skill.id)).flatMap(skill=>skill.tools);}

export function buildToolsForAgent(agentTools:AiToolDefinition[],isAutonomous:boolean,userId:string,agentId?:string,activeSkills:string[]=[]):Record<string,any>{
 const vercelTools:Record<string,any>={};const registryTools=selectedRegistryTools(activeSkills);const toolDefs=new Map<string,any>();
 for(const registeredTool of registryTools)toolDefs.set(registeredTool.id,{kind:"registry",definition:registeredTool});
 for(const panelTool of panelTools)if(!toolDefs.has(panelTool.name))toolDefs.set(panelTool.name,{kind:"panel",definition:panelTool});
 for(const def of agentTools)if(!toolDefs.has(def.name))toolDefs.set(def.name,{kind:"legacy",definition:def});
 for(const [toolId,entry] of toolDefs.entries()){
  if(entry.kind==="registry"){
   const registeredTool=entry.definition;const shouldAutoExecute=isAutonomous?registeredTool.supportsAutopilot:!registeredTool.requiresConfirmation;
   const execute=async(args:any)=>{try{return await materializeToolResult(await registeredTool.execute!(args,{userId} as any),registeredTool.id,args);}catch(error:any){console.error(`[TOOL] ${registeredTool.id}`,error);return{success:false,error:error?.message||"Tool execution failed"};}};
   vercelTools[toolId]=(tool as any)({description:registeredTool.description,parameters:registeredTool.schema,...(shouldAutoExecute&&registeredTool.execute?{execute}:{})});
  }else if(entry.kind==="panel"){
   const panel=entry.definition;const shouldAutoExecute=isAutonomous?(!panel.requiresConfirmation&&panel.supportsAutopilot!==false):!panel.requiresConfirmation;
   vercelTools[toolId]=(tool as any)({description:panel.description,parameters:panel.schema,...(shouldAutoExecute?{execute:async(args:any)=>panel.execute(args)}:{})});
  }else{
   const def=entry.definition;const shouldAutoExecute=isAutonomous?!def.requiresConfirmation:!def.requiresConfirmation&&!def.externalEffect;
   vercelTools[toolId]=(tool as any)({description:def.description,parameters:z.record(z.any()).describe("Arguments for the tool"),...(shouldAutoExecute?{execute:async(args:any)=>{try{const{confirmAndExecuteTool}=await import("@/actions/ai-tutor");return await materializeToolResult(await confirmAndExecuteTool(def.name,args),def.name,args);}catch(error:any){return{success:false,error:error?.message||"Tool execution failed"};}}}: {})});
  }
 }
 return vercelTools;
}
