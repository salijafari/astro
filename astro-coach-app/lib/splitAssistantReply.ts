/**
 * Splits assistant text on ---FOLLOW_UPS--- or trailing JSON followUps (matches server AMA parsing).
 */
export const splitAssistantReply = (raw: string): { body: string; followUps: string[] } => {
  let full = raw;
  let followUps: string[] = [];
  const followUpSplit = full.split("---FOLLOW_UPS---");
  if (followUpSplit.length > 1) {
    full = followUpSplit[0]!.trim();
    followUps = followUpSplit[1]!
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } else {
    const jmatch = full.match(/\{[\s\S]*"followUpPrompts"[\s\S]*\}\s*$/);
    if (jmatch) {
      try {
        const j = JSON.parse(jmatch[0]) as { followUpPrompts?: string[] };
        followUps = j.followUpPrompts ?? [];
      } catch {
        /* ignore */
      }
    }
  }
  return { body: full, followUps };
};
