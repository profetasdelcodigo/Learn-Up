import { aiRegistry } from "../core/registry";
import { researchSkill } from "./research";
import { calendarSkill } from "./calendar";
import { knowledgeGraphSkill } from "./knowledge-graph";
import { chatSkill } from "./chat";
import { librarySkill } from "./library";
import { contentSkill } from "./content";
import { multimediaSkill } from "./multimedia";

// Register all skills
export function registerAllSkills() {
  aiRegistry.registerSkill(researchSkill);
  aiRegistry.registerSkill(calendarSkill);
  aiRegistry.registerSkill(knowledgeGraphSkill);
  aiRegistry.registerSkill(chatSkill);
  aiRegistry.registerSkill(librarySkill);
  aiRegistry.registerSkill(multimediaSkill);
  aiRegistry.registerSkill(contentSkill);
  // Future skills will be imported and registered here
}

// Automatically register them upon module load
registerAllSkills();

export { aiRegistry } from "../core/registry";
