import fs from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), "learn-up/src/components/AIChatComponent.tsx");
let s = fs.readFileSync(p, "utf8");

const old = `        if (result.actions && result.actions.length > 0) {\n          if (isAutonomous) {\n            result.actions.forEach(action => {\n               setTimeout(() => handleConfirmAction(action), 500);\n            });\n          } else {\n            setPendingActions(result.actions);\n          }\n        }`;

const newer = `        if (result.actions && result.actions.length > 0 && !isAutonomous) {\n          setPendingActions(result.actions);\n        }`;

if (s.includes(old)) {
  s = s.replace(old, newer);
} else {
  s = s.replace(/        if \(result\.actions && result\.actions\.length > 0\) \{[\s\S]*?\n        \}/m, newer);
}

// Do not persist the same media message twice. Keep the later save as the canonical non-media path.
const mediaBlock = `    if (backupFile) {`;
const mediaEnd = s.indexOf(`      setUploadingMedia(false);`, s.indexOf(mediaBlock));
if (mediaEnd > 0) {
  const blockStart = s.indexOf(mediaBlock);
  const block = s.slice(blockStart, mediaEnd);
  const duplicate = block.match(/const mediaMessage = await addAiMessage\([\s\S]*?\);\n        if \(mediaMessage\?\.error\) throw new Error\(mediaMessage\.error\);/g);
  if (duplicate && duplicate.length > 1) {
    const first = duplicate[0];
    const second = duplicate[1];
    s = s.replace(second, "");
  }
}

fs.writeFileSync(p, s);
console.log("[autopilot-ui] applied");
