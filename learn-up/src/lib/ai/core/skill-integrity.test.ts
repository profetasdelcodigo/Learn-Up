import { describe, expect, it } from "vitest";
import { aiRegistry } from "../skills";
import { ALL_PACKS, PACK_TO_SKILL, normalizeSkillPacks } from "./tool-catalog";
import { APP_ROUTES, isValidInternalRoute } from "./route-registry";

const EXPECTED_COUNTS: Record<string, number> = {
  calendar_pack: 27,
  chat_pack: 25,
  library_pack: 22,
  learning_pack: 15,
  content_pack: 22,
  media_pack: 15,
  research_pack: 18,
  stats_pack: 14,
  profile_pack: 17,
  edu_pack: 20,
};

describe("AI skill integrity", () => {
  it("keeps the ten documented packs registered", () => {
    expect(ALL_PACKS).toEqual(Object.keys(EXPECTED_COUNTS));
    for (const [pack, expected] of Object.entries(EXPECTED_COUNTS)) {
      const skillId = PACK_TO_SKILL[pack];
      const skill = aiRegistry.getAllSkills().find((item) => item.id === skillId);
      expect(skill, `${pack} -> ${skillId} no está registrado`).toBeDefined();
      expect(skill?.tools.length, `${pack} tiene una cantidad de tools inesperada`).toBe(expected);
    }
  });

  it("normalizes pack ids and legacy skill ids consistently", () => {
    expect(normalizeSkillPacks(["research", "research_pack", "education", "profile_pack", "social"]))
      .toEqual(["research_pack", "edu_pack", "profile_pack"]);
  });

  it("requires every registered tool to declare execution metadata", () => {
    for (const skill of aiRegistry.getAllSkills()) {
      for (const tool of skill.tools) {
        expect(tool.id, `${skill.id}: tool sin id`).toBeTruthy();
        expect(tool.description, `${skill.id}/${tool.id}: sin descripción`).toBeTruthy();
        expect(tool.schema, `${skill.id}/${tool.id}: sin schema`).toBeTruthy();
        expect(typeof tool.requiresConfirmation, `${skill.id}/${tool.id}: requiresConfirmation inválido`).toBe("boolean");
        expect(typeof tool.supportsAutopilot, `${skill.id}/${tool.id}: supportsAutopilot inválido`).toBe("boolean");
        expect(typeof tool.supportsParallel, `${skill.id}/${tool.id}: supportsParallel inválido`).toBe("boolean");
      }
    }
  });

  it("keeps internal navigation limited to registered routes", () => {
    for (const route of APP_ROUTES) expect(isValidInternalRoute(route.path)).toBe(true);
    expect(isValidInternalRoute("/web 0")).toBe(false);
    expect(isValidInternalRoute("javascript:alert(1)")).toBe(false);
  });
});
