/**
 * Server-side Markdown cleanup for persisted assistant messages (AMA chat).
 * Kept aligned with `astro-coach-app/lib/sanitizeStreamText.ts` where practical.
 */
export function sanitizeAssistantText(text: string): string {
  if (!text) return text;
  let result = text;
  result = result.replace(/^#{1,6}\s+/gm, "");
  result = result.replace(/\*\*(.*?)\*\*/g, "$1");
  result = result.replace(/__(.*?)__/g, "$1");
  result = result.replace(/\*{1,3}/g, "");
  result = result.replace(/^-{3,}$/gm, "");
  result = result.replace(/^={3,}$/gm, "");
  result = result.replace(/^\*{3,}$/gm, "");
  result = result.replace(/^[\s]*[-*+]\s+/gm, "");
  result = result.replace(/^[\s]*\d+\.\s+/gm, "");
  result = result.replace(/`{1,3}(.*?)`{1,3}/g, "$1");
  result = result.replace(/^>\s*/gm, "");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result
    .split("\n")
    .map((line: string) => line.trimEnd())
    .join("\n");
  return result.trim();
}
