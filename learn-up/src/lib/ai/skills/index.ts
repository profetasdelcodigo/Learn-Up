import { aiRegistry } from "../core/registry";
import { researchSkill } from "./research";
import { calendarSkill } from "./calendar";
import { knowledgeGraphSkill } from "./knowledge-graph";
import { chatSkill } from "./chat";
import { librarySkill } from "./library";
import { contentSkill } from "./content";
import { multimediaSkill } from "./multimedia";
import { analyticsSkill } from "./analytics";
import { profileSocialSkill } from "./social";
import { educationSkill } from "./education";

export function registerAllSkills() {
  aiRegistry.registerSkill(researchSkill);
  aiRegistry.registerSkill(calendarSkill);
  aiRegistry.registerSkill(knowledgeGraphSkill);
  aiRegistry.registerSkill(chatSkill);
  aiRegistry.registerSkill({ ...librarySkill, tools: librarySkill.tools.filter((tool) => tool.id !== "query_repositories") });
  aiRegistry.registerSkill({ ...contentSkill, id: "content_generation" });
  aiRegistry.registerSkill(multimediaSkill);
  aiRegistry.registerSkill(analyticsSkill);
  aiRegistry.registerSkill(profileSocialSkill);
  aiRegistry.registerSkill(educationSkill);
}

registerAllSkills();
export { aiRegistry } from "../core/registry";
