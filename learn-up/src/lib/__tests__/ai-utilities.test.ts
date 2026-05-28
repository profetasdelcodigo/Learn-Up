import { describe, it, expect, vi } from "vitest";
import { parseToolCall } from "@/lib/ai-tools";
import { extractDocumentText } from "@/lib/ai";
import { buildUserMessage } from "@/actions/ai-tutor";

// Mock youtube-transcript module since parseMediaInput imports and uses it
vi.mock("youtube-transcript", () => {
  return {
    YoutubeTranscript: {
      fetchTranscript: vi.fn().mockResolvedValue([
        { text: "Este es un transcript simulado del video de YouTube." }
      ]),
    },
  };
});

describe("parseToolCall", () => {
  it("should return clean text and null action when no tool block is present", async () => {
    const response = "Hola, ¿cómo puedo ayudarte hoy?";
    const result = await parseToolCall(response);
    expect(result.cleanText).toBe(response);
    expect(result.action).toBeNull();
  });

  it("should parse a valid open_url tool call and strip the block", async () => {
    const response = `Recomiendo este recurso.\n\`\`\`tool\n{"tool": "open_url", "args": {"url": "https://wikipedia.org", "title": "Wikipedia"}}\n\`\`\``;
    const result = await parseToolCall(response);
    expect(result.cleanText).toBe("Recomiendo este recurso.");
    expect(result.action).toEqual({
      tool: "open_url",
      args: { url: "https://wikipedia.org", title: "Wikipedia" },
      description: "¿Quieres abrir Wikipedia?",
      requiresConfirm: true,
    });
  });

  it("should validate and fail a tool call with invalid arguments", async () => {
    const response = `Mira esto:\n\`\`\`tool\n{"tool": "open_url", "args": {"url": "invalid-url", "title": "Bad Link"}}\n\`\`\``;
    const result = await parseToolCall(response);
    expect(result.action).toBeNull();
    expect(result.cleanText).toBe("Mira esto:");
  });

  it("should parse and validate a valid save_learned_concept tool call", async () => {
    const response = `¡Genial que hayas entendido la fotosíntesis!\n\`\`\`tool\n{"tool": "save_learned_concept", "args": {"title": "Fotosíntesis", "description": "Proceso de las plantas"}}\n\`\`\``;
    const result = await parseToolCall(response);
    expect(result.cleanText).toBe("¡Genial que hayas entendido la fotosíntesis!");
    expect(result.action).toEqual({
      tool: "save_learned_concept",
      args: { title: "Fotosíntesis", description: "Proceso de las plantas" },
      description: "Guardando concepto en tu mapa mental...",
      requiresConfirm: false,
    });
  });
});

describe("extractDocumentText", () => {
  it("should extract text from plain text buffers", async () => {
    const text = "Hola Mundo, esto es un archivo de texto.";
    const buffer = Buffer.from(text, "utf-8");
    const result = await extractDocumentText(buffer, "test.txt", "text/plain");
    expect(result).toBe(text);
  });

  it("should extract text from markdown files", async () => {
    const markdown = "# Mi Título\n**Negrita**";
    const buffer = Buffer.from(markdown, "utf-8");
    const result = await extractDocumentText(buffer, "notes.md", "text/markdown");
    expect(result).toBe(markdown);
  });

  it("should throw an error for unsupported files", async () => {
    const buffer = Buffer.from([1, 2, 3]);
    await expect(extractDocumentText(buffer, "image.png", "image/png")).rejects.toThrow(
      "Tipo de documento no soportado para extraccion."
    );
  });
});

describe("buildUserMessage", () => {
  it("should return normal message when no mediaUrl or YouTube link is present", async () => {
    const message = "Hola profesor";
    const result = await buildUserMessage(message);
    expect(result.content).toBe("Hola profesor");
    expect(result.model).toBe("gemini-3-flash-preview");
  });

  it("should extract YouTube transcripts from link in message", async () => {
    const message = "Mira este video https://youtube.com/watch?v=12345";
    const result = await buildUserMessage(message);
    expect(result.content).toContain("Mira este video");
    expect(result.content).toContain("[Transcripción del video en el enlace]:");
    expect(result.content).toContain("Este es un transcript simulado del video de YouTube.");
  });

  it("should adjust model and format for generic mediaUrl", async () => {
    const message = "Analiza esta imagen";
    const mediaUrl = "https://example.com/image.jpg";
    const result = await buildUserMessage(message, mediaUrl, "image/jpeg");
    expect(result.model).toBe("gemini-3-flash-preview");
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content[0]).toEqual({ type: "text", text: "Analiza esta imagen" });
    expect(result.content[1]).toEqual({ type: "file_url", file_url: { url: mediaUrl } });
  });
});
