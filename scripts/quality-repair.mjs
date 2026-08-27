import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

// Fix legacy lint errors without suppressing rules globally.
{
  const p = "learn-up/src/lib/ai-tools.ts";
  let s = read(p);
  s = s.replace("const registryTool = require('./ai/agent-registry').AI_AGENT_REGISTRY.find((t: any) => t.name === toolName);", "const registryTool = Object.values(AI_AGENT_REGISTRY).flatMap((agent) => agent.tools).find((t) => t.name === toolName);");
  s = s.replace("  let action: ToolAction | null = null;\n  let actions: ToolAction[] = [];", "  const action: ToolAction | null = null;\n  const actions: ToolAction[] = [];");
  s = s.replace("          let updates: any = {};", "          const updates: any = {};");
  s = s.replace("        let { title, description, date, start_time, end_time, recurrence_rule, reminder_minutes } = args;", "        const { title, description, date, start_time, end_time, recurrence_rule, reminder_minutes } = args;");
  write(p, s);
}

{
  const p = "learn-up/src/components/NotebookWhiteboard.tsx";
  let s = read(p);
  if (s.includes('const { createClient } = require("@/utils/supabase/client");')) {
    s = s.replace('import {', 'import {')
      .replace('const { createClient } = require("@/utils/supabase/client");\n    const supabase = createClient();', 'const supabase = createClient();');
    if (!s.includes('from "@/utils/supabase/client"')) {
      s = s.replace(/^(import[^\n]+\n)+/, (m) => m + 'import { createClient } from "@/utils/supabase/client";\n');
    }
  }
  write(p, s);
}

{
  const p = "learn-up/src/components/JarvisGlobalWidget.tsx";
  let s = read(p);
  s = s.replace('¿Deseas que busque "{action.args.query}" en internet?', '¿Deseas que busque &quot;{action.args.query}&quot; en internet?');
  s = s.replace('¿Quieres abrir "{action.args.url}"?', '¿Quieres abrir &quot;{action.args.url}&quot;?');
  write(p, s);
}

{
  const p = "learn-up/src/app/legal/page.tsx";
  let s = read(p);
  s = s.replace(/<strong className=\"text-\[var\(--foreground\)\]\">([^<]*)<\/strong>/g, (m, text) => `<strong className="text-[var(--foreground)]">${text.replace(/'/g, "&apos;").replace(/"/g, "&quot;")}</strong>`);
  s = s.replace(/>\s*([^<>\n]*['"][^<>\n]*)\s*</g, (m, text) => `>${text.replace(/'/g, "&apos;").replace(/"/g, "&quot;")}<`);
  write(p, s);
}

// Remove accidental duplicate ref declarations if present.
{
  const p = "learn-up/src/components/AIChatComponent.tsx";
  let s = read(p);
  const needle = '  const submitInFlight = useRef(false);';
  const count = s.split(needle).length - 1;
  if (count > 1) {
    let seen = 0;
    s = s.split(needle).join((() => { seen += 1; return seen === 1 ? needle : ''; })());
  }
  write(p, s);
}

console.log("quality repair complete");
