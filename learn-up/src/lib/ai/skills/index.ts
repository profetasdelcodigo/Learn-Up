import { aiRegistry } from "../core/registry";
import { researchSkill } from "./research";
import { calendarSkill } from "./calendar";
import { knowledgeGraphSkill } from "./knowledge-graph";
import { chatSkill } from "./chat";
import { chatExtendedSkill } from "./chat/extended";
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
import { withFinalCalendarReminderOverrides } from "./calendar-reminder-final";
import { withFinalSocialOverrides } from "./social-final-overrides";
import { withFriendRequestOverrides } from "./social-request-override";
import { withFinalKnowledgeGraphOverrides } from "./knowledge-graph-final-overrides";
import { withFinalAnalyticsOverrides } from "./analytics-final-overrides";
import { withFinalContentOverrides } from "./content-final-overrides";
import { withFinalEducationOverrides } from "./education-final-overrides";
import { withFinalChatOverrides } from "./chat-final-overrides";
import { withUniversalFinalOverrides } from "./universal-final-overrides";
import { withExecutableGenerativeTools } from "./execute-generative-result";

function registerSkill(skill: Parameters<typeof aiRegistry.registerSkill>[0]) {
  aiRegistry.registerSkill(withUniversalFinalOverrides(withExecutableGenerativeTools(skill)));
}

export function registerAllSkills() {
  registerSkill(withFinalResearchOverrides(withRealResearchOverrides(withRealSkillOverrides(researchSkill))));
  registerSkill(withFinalCalendarReminderOverrides(withFinalCalendarOverrides(calendarSkill)));
  registerSkill(withFinalKnowledgeGraphOverrides(knowledgeGraphSkill));
  registerSkill(withFinalChatOverrides(withRealSkillOverrides(chatSkill)));
  registerSkill(chatExtendedSkill);
  registerSkill(withFinalLibraryOverrides(withRealSkillOverrides(librarySkill)));
  registerSkill(withFinalContentOverrides({ ...withRealSkillOverrides(contentSkill), id: "content_generation" }));
  registerSkill(withRealMultimediaOverrides(multimediaSkill));
  registerSkill(withFinalAnalyticsOverrides(withRealAnalyticsOverrides(analyticsSkill)));
  registerSkill(withFriendRequestOverrides(withFinalSocialOverrides(profileSocialSkill)));
  registerSkill(withFinalEducationOverrides(educationSkill));
}

registerAllSkills();
export { aiRegistry } from "../core/registry";
