import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function update(file, transform) {
  const full = path.join(root, file);
  const before = fs.readFileSync(full, "utf8");
  const after = transform(before);
  if (before === after) return false;
  fs.writeFileSync(full, after);
  console.log(`[lint-fix] updated ${file}`);
  return true;
}

update("learn-up/src/app/legal/page.tsx", (s) =>
  s.replace(/trimmed\.replace\(\/\^###\\s\*\/, &quot;\)/g, 'trimmed.replace(/^###\\s*/, "")')
   .replace(/trimmed\.replace\(\/\^##\\s\*\/, &quot;\)/g, 'trimmed.replace(/^##\\s*/, "")')
   .replace(/trimmed\.replace\(\/\^#\\s\*\/, &quot;\)/g, 'trimmed.replace(/^#\\s*/, "")')
   .replace(/trimmed\.replace\(\/\^- \/, &quot;\)/g, 'trimmed.replace(/^- /, "")')
);

update("learn-up/src/lib/ai-tools.ts", (s) =>
  s.replace(
    /let \{ title, description, date, start_time, end_time, recurrence_rule, reminder_minutes \} = args;/g,
    'const { title, description, recurrence_rule, reminder_minutes } = args;\n        let { date } = args;'
  )
);

console.log("[lint-fix] completed");
