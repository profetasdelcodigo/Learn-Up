import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "learn-up/src/components/AIChatComponent.tsx");
let s = fs.readFileSync(file, "utf8");

const oldBlock = `        const indexResult = await indexAiDocumentFromUrl({\n          title: backupFile.name,\n          url: mediaUrl,\n          mimeType: backupFile.type,\n          sessionId,\n        });\n        if (!indexResult.success) {\n          console.warn("AI document indexing skipped:", indexResult.error);\n        }\n\n        setMessages((prev) => \n          prev.map(m => m.clientMessageId === clientMessageId ? { ...m, media_url: mediaUrl } : m)\n        );`;

if (!s.includes(oldBlock)) {
  throw new Error("Attachment indexing block not found; aborting without modifying the component.");
}

const newBlock = `        setMessages((prev) =>\n          prev.map(m => m.clientMessageId === clientMessageId ? { ...m, media_url: mediaUrl } : m)\n        );`;
s = s.replace(oldBlock, newBlock);

const oldSave = `    try {\n      const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n    } catch (msgErr: any) {`;

const newSave = `    try {\n      const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n    } catch (msgErr: any) {`;
if (!s.includes(oldSave)) throw new Error("Message persistence block not found.");

const insertAfter = `      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n`;
const indexingAfterSave = `      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n\n      // Indexing is deliberately AFTER message persistence.\n      // Failure/latency here must never make the user's attachment disappear from chat.\n      if (backupFile && mediaUrl) {\n        try {\n          const indexResult = await indexAiDocumentFromUrl({\n            title: backupFile.name,\n            url: mediaUrl,\n            mimeType: backupFile.type,\n            sessionId,\n          });\n          if (!indexResult.success) {\n            console.warn("AI document indexing skipped:", indexResult.error);\n          }\n        } catch (indexError) {\n          console.warn("AI document indexing failed after message persistence:", indexError);\n        }\n      }\n`;
s = s.replace(insertAfter, indexingAfterSave);

// Clear attachment state explicitly only after durable persistence/AI request path has started.
s = s.replace(`    setFile(null);\n    if (fileInputRef.current) fileInputRef.current.value = "";`, `    setFile(null);\n    setHasFileAttached(Boolean(backupFile));\n    if (fileInputRef.current) fileInputRef.current.value = "";`);

fs.writeFileSync(file, s);
console.log("Attachment persistence repair applied.");
