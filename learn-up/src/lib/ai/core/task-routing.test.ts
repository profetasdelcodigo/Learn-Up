import { describe, expect, it } from "vitest";
import { inferTaskDomains, toolMatchesDomains } from "./task-routing";

const tool = (id: string, category: string, description = "") => ({
  id,
  name: id,
  category,
  description,
  schema: undefined,
  requiresConfirmation: false,
  externalEffect: false,
  readOnly: true,
  supportsAutopilot: true,
  supportsParallel: false,
  uiType: "generic" as const,
});

describe("task routing", () => {
  it("routes an event request to calendar without research", () => {
    const domains = inferTaskDomains("Crea un evento para mañana a las 5");
    expect(domains).toContain("calendar");
    expect(domains).not.toContain("research");
  });

  it("routes an explicit research request to research", () => {
    const domains = inferTaskDomains("Investiga fuentes sobre la fotosíntesis");
    expect(domains).toContain("research");
    expect(domains).not.toContain("calendar");
  });

  it("does not classify a calendar tool as research from description prose", () => {
    const calendarTool = tool("add_calendar_event", "calendar", "Crea un evento y permite abrir un enlace web relacionado.");
    expect(toolMatchesDomains(calendarTool, ["research"])).toBe(false);
    expect(toolMatchesDomains(calendarTool, ["calendar"])).toBe(true);
  });
});
