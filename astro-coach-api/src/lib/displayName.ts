/**
 * Returns the language-appropriate display name for a user.
 *
 * Rules:
 * - If language is "fa" AND nameFa is set and non-empty → return nameFa
 * - Otherwise → return name (trimmed)
 * - If name is also empty → return language-appropriate fallback
 *
 * This is the SINGLE SOURCE OF TRUTH for user name in all LLM prompts.
 * Never access user.name directly for LLM purposes — always use this.
 */
export function getDisplayName(
  user: { name: string; nameFa?: string | null },
  language: string,
): string {
  if (language === "fa") {
    const fa = user.nameFa?.trim();
    if (fa) return fa;
  }
  const en = user.name?.trim();
  if (en) return en;
  return language === "fa" ? "دوست" : "Friend";
}
