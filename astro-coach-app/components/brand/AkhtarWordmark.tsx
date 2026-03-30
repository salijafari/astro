import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";

const WORDMARK_SOURCE = require("@/assets/AkhtarTodayCompressed.png");
/** Native pixel ratio of `AkhtarTodayCompressed.png` (width / height). */
const WORDMARK_ASPECT = 771 / 258;
/** Home + sign-in wordmark: 70% of prior caps (~30% smaller). */
const HOME_WORDMARK_SCALE = 0.7;
/** Dashboard only: 20% smaller than `home` (0.8 × home width). */
const DASHBOARD_WORDMARK_SCALE = 0.8;

type Props = {
  /** `hero`: onboarding; `home`: sign-in / shared; `dashboard`: home screen (smaller); `header`: tab bar title */
  size?: "hero" | "header" | "home" | "dashboard";
};

/**
 * Akhtar wordmark from bundled PNG. Width scales with the window; height follows the asset aspect ratio (Section 9: Dimensions-based layout).
 */
export function AkhtarWordmark({ size = "hero" }: Props) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();

  const homeMaxWidth = Math.round(Math.min(300, windowWidth * 0.88) * HOME_WORDMARK_SCALE);

  const maxWidth =
    size === "hero"
      ? Math.min(340, windowWidth * 0.92)
      : size === "home"
        ? homeMaxWidth
        : size === "dashboard"
          ? Math.round(homeMaxWidth * DASHBOARD_WORDMARK_SCALE)
          : Math.min(152, windowWidth * 0.42);

  const height = Math.round(maxWidth / WORDMARK_ASPECT);

  return (
    <View className="items-center justify-center py-2">
      <Image
        source={WORDMARK_SOURCE}
        style={{ width: maxWidth, height }}
        contentFit="contain"
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("brand.name")}
      />
    </View>
  );
}
