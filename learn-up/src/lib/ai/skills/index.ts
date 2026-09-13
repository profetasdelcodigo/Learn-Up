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
import { withCalendarTimezoneFix } from "./calendar-timezone-final";
import { withFinalSocialOverrides } from "./social-final-overrides";
import { withFriendRequestOverrides } from "./social-request-override";
import { withFinalKnowledgeGraphOverrides } from "./knowledge-graph-final-overrides";
import { withFinalAnalyticsOverrides } from "./analytics-final-overrides";
import { withFinalContentOverrides } from "./content-final-overrides";
import { withFinalEducationOverrides } from "./education-final-overrides";
import { withFinalChatOverrides } from "./chat-final-overrides";
import { withUniversalFinalOverrides } from "./universal-final-overrides";
import { withExecutableGenerativeTools } from "./execute-generative-result";
import { withElevenLabsTts } from "./elevenlabs-tts";
import { withCloudflareCapabilityRouting } from "./cloudflare-capability-overrides";
import { withTaskRoutingGuard } from "./task-routing-guard";

function enforceAutopilotSafety<T extends { tools?: any[] }>(skill: T): T {
  if (!Array.isArray(skill.tools)) return skill;
  return {
    ...skill,
    tools: skill.tools.map((tool) => ({
      ...tool,
      // Autopilot is intentionally read-only. Anything that writes, sends,
      // deletes, changes external state, or is otherwise non-read must remain
      // behind the approval card even when the user enabled autopilot.
      supportsAutopilot: tool?.risk === "read" && tool?.supportsAutopilot === true,
    })),
  };
}

function registerSkill(skill: Parameters<typeof aiRegistry.registerSkill>[0]) {
  const guardedSkill = enforceAutopilotSafety(withUniversalFinalOverrides(withTaskRoutingGuard(withExecutableGenerativeTools(skill))));
  aiRegistry.registerSkill(guardedSkill);
}

export function registerAllSkills() {
  registerSkill(withFinalResearchOverrides(withRealResearchOverrides(withRealSkillOverrides(researchSkill))));
  registerSkill(withCalendarTimezoneFix(withFinalCalendarReminderOverrides(withFinalCalendarOverrides(calendarSkill))));
  registerSkill(withFinalKnowledgeGraphOverrides(knowledgeGraphSkill));

  const chatWithExtensions = {
    ...withRealSkillOverrides(chatSkill),
    tools: [
      ...withRealSkillOverrides(chatSkill).tools,
      ...chatExtendedSkill.tools,
    ],
  };
  registerSkill(withFinalChatOverrides(chatWithExtensions));

  registerSkill(withFinalLibraryOverrides(withRealSkillOverrides(librarySkill)));
  registerSkill(withFinalContentOverrides({ ...withRealSkillOverrides(contentSkill), id: "content_generation" }));
  registerSkill(withElevenLabsTts(withCloudflareCapabilityRouting(withRealMultimediaOverrides(multimediaSkill))));
  registerSkill(withFinalAnalyticsOverrides(withRealAnalyticsOverrides(analyticsSkill)));
  registerSkill(withFriendRequestOverrides(withFinalSocialOverrides(profileSocialSkill)));
  registerSkill(withFinalEducationOverrides(educationSkill));
}

registerAllSkills();
export { aiRegistry } from "../core/registry";
