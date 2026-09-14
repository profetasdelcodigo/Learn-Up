import { describe, expect, it } from "vitest";
import { shouldExecuteTool, getToolDefinition } from "@/lib/ai/tool-contract";
import { inferTaskDomains } from "@/lib/ai/core/task-routing";

describe("Learn Up AI safety routing", () => {
  it("never auto-executes a registered write tool in autopilot", () => {
    const definition = getToolDefinition("upload_library_file");
    expect(definition.readOnly).toBe(false);
    expect(definition.supportsAutopilot).toBe(false);
    expect(shouldExecuteTool("upload_library_file", "autopilot")).toBe("pending_confirmation");
  });

  it("never auto-executes destructive actions in autopilot", () => {
    for (const tool of ["delete_calendar_event", "delete_indexed_document", "delete_account", "block_user"]) {
      expect(shouldExecuteTool(tool, "autopilot")).toBe("pending_confirmation");
    }
  });

  it("allows explicit read-only tools in autopilot", () => {
    expect(shouldExecuteTool("search_library", "autopilot")).toBe("execute");
    expect(shouldExecuteTool("view_study_stats", "autopilot")).toBe("execute");
    expect(shouldExecuteTool("search_web", "autopilot")).toBe("execute");
  });

  it("honors a denied permission even for a read-only tool", () => {
    expect(shouldExecuteTool("search_library", "autopilot", false)).toBe("deny");
    expect(shouldExecuteTool("search_library", "manual", false)).toBe("deny");
  });

  it("routes calendar requests without accidentally enabling research", () => {
    expect(inferTaskDomains("¿Qué eventos tengo esta semana?")).toEqual(["calendar"]);
  });

  it("routes explicit research requests to research", () => {
    expect(inferTaskDomains("Investiga las noticias más recientes sobre IA y dame fuentes.")).toEqual(["research"]);
  });

  it("keeps ambiguous requests general instead of activating unrelated skills", () => {
    expect(inferTaskDomains("destruir el mundo")).toEqual(["general"]);
  });
});
