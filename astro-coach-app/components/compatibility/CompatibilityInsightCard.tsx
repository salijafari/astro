import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { AppTheme } from "@/constants/theme";
import { useThemeColors } from "@/lib/themeColors";

export type CompatibilityReportPayload = {
  id: string;
  overallScore: number;
  emotionalScore: number;
  communicationScore: number;
  attractionScore: number;
  longTermScore: number;
  conflictScore: number;
  narrativeSummary: string;
  tips: unknown;
  isFullReport: boolean;
  isEstimate: boolean;
};

type Props = {
  report: CompatibilityReportPayload;
  rtl: boolean;
  theme: AppTheme;
};

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function overallWord(score: number, t: (k: string) => string): string {
  const s = clampScore(score);
  if (s >= 80) return t("compatibility.descriptors.magnetic");
  if (s >= 60) return t("compatibility.descriptors.harmonious");
  if (s >= 40) return t("compatibility.descriptors.growing");
  return t("compatibility.descriptors.challenging");
}

function dimensionDescriptor(
  score: number,
  dim: "emotional" | "communication" | "attraction" | "longTerm",
  t: (k: string) => string,
): string {
  const s = clampScore(score);
  if (dim === "attraction" && s >= 80) return t("compatibility.descriptors.magnetic");
  if (s >= 80) return t("compatibility.descriptors.harmonious");
  if (s >= 60) return t("compatibility.descriptors.good");
  if (s >= 40) return t("compatibility.descriptors.growing");
  return t("compatibility.descriptors.challenging");
}

function scoreBarColor(score: number): string {
  const s = clampScore(score);
  if (s >= 70) return "#14b8a6";
  if (s >= 45) return "#6366f1";
  return "#f59e0b";
}

/**
 * In-thread compatibility insight: ring-style track + fill bar, dimension grid, narrative, tips.
 * Uses View-based progress (no react-native-svg) for broad platform support.
 */
export const CompatibilityInsightCard: React.FC<Props> = ({ report, rtl, theme }) => {
  const { t } = useTranslation();
  const tc = useThemeColors();
  const overall = clampScore(report.overallScore);
  const barColor = scoreBarColor(overall);
  const tips = Array.isArray(report.tips)
    ? report.tips.filter((x): x is string => typeof x === "string")
    : [];

  const textAlign = rtl ? "right" : "left";
  const rowRev = rtl ? "flex-row-reverse" : "flex-row";

  const dims: Array<{
    key: string;
    icon: string;
    labelKey: string;
    dim: "emotional" | "communication" | "attraction" | "longTerm";
    score: number;
  }> = [
    { key: "e", icon: "♥", labelKey: "compatibility.dim.emotional", dim: "emotional", score: report.emotionalScore },
    {
      key: "c",
      icon: "💬",
      labelKey: "compatibility.dim.communication",
      dim: "communication",
      score: report.communicationScore,
    },
    { key: "a", icon: "✦", labelKey: "compatibility.dim.attraction", dim: "attraction", score: report.attractionScore },
    { key: "l", icon: "🌱", labelKey: "compatibility.dim.longTerm", dim: "longTerm", score: report.longTermScore },
  ];

  return (
    <View className="mb-3 items-start">
      <View
        className="max-w-[95%] rounded-3xl border px-4 py-4"
        style={{
          borderColor: theme.colors.outline,
          backgroundColor: theme.colors.surface,
        }}
      >
        <View className="items-center py-2">
          <View
            className="h-[100px] w-[100px] items-center justify-center rounded-full border-[6px]"
            style={{ borderColor: theme.colors.outlineVariant }}
          >
            <Text className="text-2xl">♥</Text>
            <Text
              className="mt-1 text-xs font-semibold uppercase"
              style={{ color: tc.textSecondary, writingDirection: rtl ? "rtl" : "ltr" }}
            >
              {overallWord(overall, t)}
            </Text>
          </View>
          <View
            className="mt-3 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full"
            style={{ backgroundColor: theme.colors.outlineVariant }}
          >
            <View className="h-full rounded-full" style={{ width: `${overall}%`, backgroundColor: barColor }} />
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          {dims.map((d) => (
            <View
              key={d.key}
              className="min-w-[46%] flex-1 rounded-2xl border px-3 py-2"
              style={{ borderColor: theme.colors.outlineVariant }}
            >
              <View className={`items-center gap-1 ${rowRev}`}>
                <Text className="text-base">{d.icon}</Text>
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-xs uppercase tracking-wide"
                    style={{
                      color: tc.textTertiary,
                      textAlign,
                      writingDirection: rtl ? "rtl" : "ltr",
                    }}
                  >
                    {t(d.labelKey)}
                  </Text>
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: tc.textPrimary,
                      textAlign,
                      writingDirection: rtl ? "rtl" : "ltr",
                    }}
                  >
                    {dimensionDescriptor(d.score, d.dim, t)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View className="my-4 h-px" style={{ backgroundColor: theme.colors.outlineVariant }} />

        <Text
          className="text-base leading-6"
          style={{
            color: tc.textPrimary,
            textAlign,
            writingDirection: rtl ? "rtl" : "ltr",
          }}
        >
          {report.narrativeSummary}
        </Text>

        {tips.length ? (
          <View className="mt-3 gap-2">
            {tips.slice(0, 3).map((line, i) => (
              <Text
                key={`${i}-${line.slice(0, 8)}`}
                className="text-sm leading-5"
                style={{
                  color: tc.textSecondary,
                  textAlign,
                  writingDirection: rtl ? "rtl" : "ltr",
                }}
              >
                {rtl ? `← ${line}` : `→ ${line}`}
              </Text>
            ))}
          </View>
        ) : null}

        {report.isEstimate ? (
          <Text
            className="mt-3 text-xs"
            style={{
              color: tc.textTertiary,
              textAlign,
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {t("compatibility.estimateNotice")}
          </Text>
        ) : null}
        {!report.isFullReport ? (
          <Text
            className="mt-2 text-xs"
            style={{
              color: tc.textTertiary,
              textAlign,
              writingDirection: rtl ? "rtl" : "ltr",
            }}
          >
            {t("people.reportPartial")}
          </Text>
        ) : null}
      </View>
    </View>
  );
};
