/**
 * Strips common Markdown artifacts from assistant text for display and history.
 * Always pass the full accumulated buffer, not individual stream chunks.
 */
export const sanitizeStreamText = (text: string): string => {
  if (!text) return text;

  let result = text;

  result = result.replace(/^#{1,6}\s+/gm, "");
  result = result.replace(/\*\*(.*?)\*\*/g, "$1");
  result = result.replace(/__(.*?)__/g, "$1");
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1");
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "$1");
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
    .map((line) => line.trimEnd())
    .join("\n");

  result = result.trim();
  return result;
};

export const sanitizeAccumulated = sanitizeStreamText;

/*
Test cases:
sanitizeStreamText("**مهم** است") === "مهم است" ✓
sanitizeStreamText("## عنوان") === "عنوان" ✓
sanitizeStreamText("Hello **world**") === "Hello world" ✓
sanitizeStreamText("* ") === "" ✓ (orphaned from split)
sanitizeStreamText("paragraph\n\ntext") === "paragraph\n\ntext" ✓
sanitizeStreamText("emoji 🌟 here") === "emoji 🌟 here" ✓
*/
