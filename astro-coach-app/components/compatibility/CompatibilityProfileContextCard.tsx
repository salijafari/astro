import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { AppTheme } from "@/constants/theme";
import { useThemeColors } from "@/lib/themeColors";

const AVATAR_BACKDROPS = ["#6366f1", "#14b8a6", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9"];

function hashNameToColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_BACKDROPS[Math.abs(h) % AVATAR_BACKDROPS.length];
}

function relationshipPillColors(
  rel: string,
  theme: AppTheme,
): { bg: string; fg: string } {
  switch (rel) {
    case "partner":
      return { bg: `${theme.colors.primary}33`, fg: theme.colors.primary };
    case "friend":
      return { bg: "rgba(20, 184, 166, 0.22)", fg: "#14b8a6" };
    case "family":
      return { bg: "rgba(245, 158, 11, 0.22)", fg: "#f59e0b" };
    default:
      return { bg: theme.colors.surfaceVariant, fg: theme.colors.onSurfaceVariant };
  }
}

export type ProfileContextPerson = {
  id: string;
  name: string;
  relationshipType: string;
  hasFullData: boolean;
  birthDate?: string | Date | null;
};

type Props = {
  person: ProfileContextPerson;
  rtl: boolean;
  theme: AppTheme;
};

function formatBirth(iso?: string | Date | null): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Profile context bubble inside the compatibility chat thread (left / assistant side in LTR).
 */
export const CompatibilityProfileContextCard: React.FC<Props> = ({ person, rtl, theme }) => {
  const { t } = useTranslation();
  const tc = useThemeColors();
  const initial = person.name.trim().charAt(0).toUpperCase() || "?";
  const relLabel = t(`people.relationship.${person.relationshipType}`, {
    defaultValue: person.relationshipType,
  });
  const pill = relationshipPillColors(person.relationshipType, theme);
  const dob = formatBirth(person.birthDate);

  const rowDir = rtl ? "flex-row-reverse" : "flex-row";
  const textAlign = rtl ? "right" : "left";

  return (
    <View className="mb-2 items-start">
      <View
        className="max-w-[90%] rounded-xl border p-4"
        style={{
          borderColor: theme.colors.outline,
          backgroundColor: theme.colors.surface,
        }}
      >
        <View className={`items-center gap-4 ${rowDir}`}>
          <View
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: hashNameToColor(person.name) }}
          >
            <Text className="text-xl font-bold text-white">{initial}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <View className={`flex-row items-center gap-1 ${rtl ? "flex-row-reverse" : "flex-row"}`}>
              <Text
                className="text-lg font-semibold"
                style={{
                  color: tc.textPrimary,
                  textAlign,
                  writingDirection: rtl ? "rtl" : "ltr",
                }}
                numberOfLines={2}
              >
                {person.name}
              </Text>
              {person.hasFullData ? <Text style={{ color: tc.textTertiary }}> ✦</Text> : null}
            </View>
            <View
              className={`mt-1 self-start rounded-full px-2 py-0.5 ${rtl ? "self-end" : "self-start"}`}
              style={{ backgroundColor: pill.bg }}
            >
              <Text className="text-xs font-medium" style={{ color: pill.fg }}>
                {relLabel}
              </Text>
            </View>
            {dob ? (
              <Text
                className="mt-1 text-sm"
                style={{
                  color: tc.textSecondary,
                  textAlign,
                  writingDirection: rtl ? "rtl" : "ltr",
                }}
              >
                {dob}
              </Text>
            ) : null}
          </View>
        </View>
        <Text
          className="mt-3 text-sm"
          style={{
            color: tc.textTertiary,
            textAlign,
            writingDirection: rtl ? "rtl" : "ltr",
          }}
        >
          {t("compatibility.readingWith")} {person.name} ✦
        </Text>
      </View>
    </View>
  );
};
