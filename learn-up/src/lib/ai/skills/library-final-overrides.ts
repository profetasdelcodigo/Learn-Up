import type { Skill } from "../core/types";

const NON_EXECUTING_LIBRARY_TOOLS = new Set([
  "upload_library_file",
  "download_as_pdf",
]);

/**
 * These two tools cannot be performed from the AI tool contract because the
 * user-facing file upload/PDF export flows require the actual browser/file
 * object and UI download context. Keeping them in the AI registry would let
 * the model claim it performed an action that it only described.
 */
export function withFinalLibraryOverrides(skill: Skill): Skill {
  if (skill.id !== "library") return skill;
  return {
    ...skill,
    tools: skill.tools.filter((tool) => !NON_EXECUTING_LIBRARY_TOOLS.has(tool.id)),
  };
}
