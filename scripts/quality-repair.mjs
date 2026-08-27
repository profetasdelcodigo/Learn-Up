import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

{
  const p = "learn-up/src/lib/ai-tools.ts";
  let s = read(p);
  s = s.replace("const registryTool = require('./ai/agent-registry').AI_AGENT_REGISTRY.find((t: any) => t.name === toolName);", "const registryTool = Object.values(AI_AGENT_REGISTRY).flatMap((agent) => agent.tools).find((t) => t.name === toolName);");
  s = s.replace("  let action: ToolAction | null = null;\n  let actions: ToolAction[] = [];", "  const action: ToolAction | null = null;\n  const actions: ToolAction[] = [];");
  s = s.replace("          let updates: any = {};", "          const updates: any = {};");
  write(p, s);
}

{
  const p = "learn-up/src/components/NotebookWhiteboard.tsx";
  let s = read(p);
  if (!s.includes('from "@/utils/supabase/client"')) {
    s = s.replace('import { getAiEnvironment, updateAiEnvironment } from "@/actions/ai-environment";', 'import { getAiEnvironment, updateAiEnvironment } from "@/actions/ai-environment";\nimport { createClient } from "@/utils/supabase/client";');
  }
  s = s.replace('const { createClient } = require("@/utils/supabase/client");\n    const supabase = createClient();', 'const supabase = createClient();');
  write(p, s);
}

{
  const p = "learn-up/src/components/JarvisGlobalWidget.tsx";
  let s = read(p);
  s = s.replace('¿Deseas que busque "{action.args.query}" en internet?', '¿Deseas que busque &quot;{action.args.query}&quot; en internet?');
  write(p, s);
}

{
  const p = "learn-up/src/app/legal/page.tsx";
  let s = read(p);
  s = s.replace(/>([^<>\n]*?)'([^<>\n]*?)</g, (m, a, b) => `>${a}&apos;${b}<`);
  s = s.replace(/>([^<>\n]*?)\"([^<>\n]*?)</g, (m, a, b) => `>${a}&quot;${b}<`);
  write(p, s);
}

{
  const p = "learn-up/src/components/AIChatComponent.tsx";
  let s = read(p);
  const needle = '  const submitInFlight = useRef(false);';
  const parts = s.split(needle);
  if (parts.length > 2) s = parts[0] + needle + parts.slice(2).join(needle);
  write(p, s);
}

console.log("quality repair complete");
