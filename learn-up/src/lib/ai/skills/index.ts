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
import { withRealSkillOverrides } from "./real-overrides";
import { withRealResearchOverrides } from "./research-real";
import { withRealMultimediaOverrides } from "./multimedia-real";
import { withRealAnalyticsOverrides } from "./analytics-real";
import { withFinalResearchOverrides } from "./research-final-overrides";
import { withFinalLibraryOverrides } from "./library-final-overrides";
import { withFinalCalendarOverrides } from "./calendar-final-overrides";
import { withExecutableGenerativeTools } from "./execute-generative-result";

function registerSkill(skill: Parameters<typeof aiRegistry.registerSkill>[0]) {
  aiRegistry.registerSkill(withExecutableGenerativeTools(skill));
}

export function registerAllSkills() {
  registerSkill(withFinalResearchOverrides(withRealResearchOverrides(withRealSkillOverrides(researchSkill))));
  registerSkill(withFinalCalendarOverrides(calendarSkill));
  registerSkill(knowledgeGraphSkill);
  registerSkill(withRealSkillOverrides(chatSkill));
  registerSkill(withFinalLibraryOverrides(withRealSkillOverrides(librarySkill)));
  registerSkill({ ...withRealSkillOverrides(contentSkill), id: "content_generation" });
  registerSkill(withRealMultimediaOverrides(multimediaSkill));
  registerSkill(withRealAnalyticsOverrides(analyticsSkill));
  registerSkill(profileSocialSkill);
  registerSkill(educationSkill);
}

registerAllSkills();
export { aiRegistry } from "../core/registry";
