import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";

const WORDMARK_SOURCE = require("@/assets/AkhtarTodayCompressed.png");
/** Native pixel ratio of `AkhtarTodayCompressed.png` (width / height). */
const WORDMARK_ASPECT = 771 / 258;

type Props = {
  /** `hero`: onboarding; `home`: main home title; `header`: tab bar title */
  size?: "hero" | "header" | "home";
};

/**
 * Akhtar wordmark from bundled PNG. Width scales with the window; height follows the asset aspect ratio (Section 9: Dimensions-based layout).
 */
export function AkhtarWordmark({ size = "hero" }: Props) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();

  const maxWidth =
    size === "hero"
      ? Math.min(340, windowWidth * 0.92)
      : size === "home"
        ? Math.min(300, windowWidth * 0.88)
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
