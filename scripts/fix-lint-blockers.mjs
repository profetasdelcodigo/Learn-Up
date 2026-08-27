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

update("learn-up/src/components/LegalGate.tsx", (s) =>
  s.replace("Children's Online Privacy Protection Act", "Children&apos;s Online Privacy Protection Act")
   .replace('(\"Jarvis\")', '(&quot;Jarvis&quot;)')
);

update("learn-up/src/lib/ai-tools.ts", (s) =>
  s.replace(
    /const \{ title, description, recurrence_rule, reminder_minutes \} = args;/g,
    'const { title, description, start_time, end_time, recurrence_rule, reminder_minutes } = args;'
  )
);

console.log("[lint-fix] completed");
