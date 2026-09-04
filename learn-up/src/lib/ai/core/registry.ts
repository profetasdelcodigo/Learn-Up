import { Skill, ToolDefinition } from "./types";

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private tools: Map<string, ToolDefinition> = new Map();

  registerSkill(skill: Skill) {
    this.skills.set(skill.id, skill);
    skill.tools.forEach(tool => {
      this.tools.set(tool.id, tool);
    });
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getTool(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
}

// Global registry instance
export const aiRegistry = new SkillRegistry();
