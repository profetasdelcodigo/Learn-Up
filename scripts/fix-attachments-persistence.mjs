import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "learn-up/src/components/AIChatComponent.tsx");
let s = fs.readFileSync(file, "utf8");

if (!s.includes("let messagePersisted = false;")) {
  const marker = "    const handleFailure = (errMessage: string) => {";
  if (!s.includes(marker)) throw new Error("Chat failure handler not found");
  s = s.replace(marker, "    let messagePersisted = false;\n\n" + marker);
}

const oldFailure = '      setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));';
const newFailure = '      if (!messagePersisted) {\n        setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));\n      } else {\n        setMessages((prev) => prev.map((m) => m.clientMessageId === clientMessageId ? { ...m, status: "failed" } : m));\n      }';
if (s.includes(oldFailure)) s = s.replace(oldFailure, newFailure);

const saveMarker = '      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);';
if (!s.includes(saveMarker)) throw new Error("Saved user message marker not found");
if (!s.includes('messagePersisted = true;')) {
  s = s.replace(saveMarker, saveMarker + '\n      messagePersisted = true;');
}

fs.writeFileSync(file, s);
console.log("Attachment persistence repair verified/applied.");
