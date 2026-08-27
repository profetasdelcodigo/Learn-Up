import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "learn-up/src/components/AIChatComponent.tsx");
let s = fs.readFileSync(file, "utf8");

// Normalize duplicated declarations introduced by previous automated repairs.
s = s.replace(/\n    let mediaMessageSaved = false;/g, "");

// Normalize the failure handler body to one deterministic branch.
const fhStart = s.indexOf('    const handleFailure = (errMessage: string) => {');
const fhBodyStart = fhStart >= 0 ? s.indexOf('      if (!messagePersisted)', fhStart) : -1;
const fhEnd = fhBodyStart >= 0 ? s.indexOf('      setLoading(false);', fhBodyStart) : -1;
if (fhBodyStart >= 0 && fhEnd > fhBodyStart) {
  const body = `      if (!messagePersisted) {\n        setMessages((prev) => prev.filter((m) => m.clientMessageId !== clientMessageId));\n      } else {\n        setMessages((prev) => prev.map((m) =>\n          m.clientMessageId === clientMessageId ? { ...m, status: "failed" } : m\n        ));\n      }\n`;
  s = s.slice(0, fhBodyStart) + body + s.slice(fhEnd);
}

// Replace the whole backupFile flow with exactly one upload + one persistence point + non-blocking indexing.
const start = s.indexOf('    if (backupFile) {');
const setUploadFalse = start >= 0 ? s.indexOf('      setUploadingMedia(false);', start) : -1;
const blockEnd = setUploadFalse >= 0 ? s.indexOf('\n    }\n\n    try {', setUploadFalse) : -1;
if (start >= 0 && setUploadFalse > start && blockEnd > setUploadFalse) {
  const canonical = `    if (backupFile) {\n      setUploadingMedia(true);\n      try {\n        const { data: { user } } = await supabase.auth.getUser();\n        if (!user) throw new Error("No autenticado");\n\n        const safeFileName = backupFile.name\n          .replace(/[^a-zA-Z0-9._-]/g, "_")\n          .slice(-120);\n        const filePath = \`${'${user.id}'}/${'${Date.now()}'}_${'${safeFileName}'}\`;\n        const { error: uploadErr } = await supabase.storage\n          .from("ai_media")\n          .upload(filePath, backupFile);\n        if (uploadErr) throw uploadErr;\n\n        const { data } = supabase.storage.from("ai_media").getPublicUrl(filePath);\n        mediaUrl = data.publicUrl;\n\n        // Durable chat persistence is the first responsibility; indexing can fail without removing the message.\n        const mediaMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n        if (mediaMessage?.error) throw new Error(mediaMessage.error);\n        messagePersisted = true;\n        setMessages((prev) => prev.map((m) =>\n          m.clientMessageId === clientMessageId ? { ...m, media_url: mediaUrl, status: "sending" } : m\n        ));\n      } catch (uploadErr: any) {\n        handleFailure("Error al subir el archivo adjunto. Intenta de nuevo.");\n        return;\n      }\n      setUploadingMedia(false);\n\n      if (mediaUrl) {\n        try {\n          const indexResult = await indexAiDocumentFromUrl({\n            title: backupFile.name,\n            url: mediaUrl,\n            mimeType: backupFile.type,\n            sessionId,\n          });\n          if (!indexResult.success) console.warn("[MEDIA] Indexación omitida:", indexResult.error);\n        } catch (indexError) {\n          console.warn("[MEDIA] Indexación falló después de persistir el mensaje:", indexError);\n        }\n      }\n    }\n\n`;
  s = s.slice(0, start) + canonical + s.slice(blockEnd + '\n    }\n\n'.length);
}

// The generic save path remains for text-only messages. For attachments it must not duplicate persistence.
const generic = `    try {\n      const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n      if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n      mediaMessageSaved = true;\n      messagePersisted = true;`;
if (s.includes(generic)) {
  s = s.replace(generic, `    try {\n      if (!messagePersisted) {\n        const savedUserMessage = await addAiMessage(sessionId, "user", userMessage, mediaUrl, mediaType, undefined, clientMessageId);\n        if (savedUserMessage?.error) throw new Error(savedUserMessage.error);\n        messagePersisted = true;\n      }`);
}

// Do not auto-execute actions twice. Agent loop already executes in autopilot.
const autoOld = `        if (result.actions && result.actions.length > 0) {\n          if (isAutonomous) {\n            result.actions.forEach(action => {\n               setTimeout(() => handleConfirmAction(action), 500);\n            });\n          } else {\n            setPendingActions(result.actions);\n          }\n        }`;
if (s.includes(autoOld)) s = s.replace(autoOld, `        if (result.actions && result.actions.length > 0 && !isAutonomous) {\n          setPendingActions(result.actions);\n        }`);

fs.writeFileSync(file, s);
console.log("[normalize-chat] complete");
