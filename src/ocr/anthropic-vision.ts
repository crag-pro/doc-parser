import { readFile } from "fs/promises";
import Anthropic from "@anthropic-ai/sdk";

export async function parseWithAnthropic(filePath: string, apiKey: string, retries = 2): Promise<string> {
  const client = new Anthropic({ apiKey });
  const buffer = await readFile(filePath);
  const base64 = buffer.toString("base64");

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: "Extract all text from this document page by page. Preserve structure where possible. Return only the extracted text, no commentary." },
          ],
        }],
      });
      const textBlock = response.content.find((c) => c.type === "text");
      return textBlock ? textBlock.text : "";
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastError;
}
