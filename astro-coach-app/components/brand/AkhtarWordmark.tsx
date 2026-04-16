import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";

const WORDMARK_SOURCE = require("@/assets/AkhtarTodayCompressed.png");
/** Native pixel ratio of `AkhtarTodayCompressed.png` (width / height). */
const WORDMARK_ASPECT = 771 / 258;
/** Home + sign-in wordmark: 70% of prior caps (~30% smaller). */
const HOME_WORDMARK_SCALE = 0.7;
/** Auth entry (welcome): compact so hero + CTAs fit one mobile screen. */
const AUTH_ENTRY_MAX_WIDTH_FRAC = 0.46;
const AUTH_ENTRY_CAP_PX = 168;
/** Dashboard only: 20% smaller than `home` (0.8 × home width). */
const DASHBOARD_WORDMARK_SCALE = 0.8;
/** Tab header wordmark (feature screens, transits, people, etc.) — slightly smaller than prior 152px cap. */
const HEADER_MAX_WIDTH_PX = 128;
const HEADER_WIDTH_FRAC = 0.34;

/** Profile setup: fixed wordmark height so the form fits on small phones (Section 9: Dimensions-based layout). */
const PROFILE_SETUP_WORDMARK_HEIGHT_PX = 80;

type Props = {
  /** `hero`: onboarding; `home`: sign-in / shared; `authEntry`: welcome auth (compact); `dashboard`: home screen (smaller); `header`: tab bar title; `profileSetup`: first-run profile form (compact height) */
  size?: "authEntry" | "dashboard" | "header" | "hero" | "home" | "profileSetup";
};

/**
 * Akhtar wordmark from bundled PNG. Width scales with the window; height follows the asset aspect ratio (Section 9: Dimensions-based layout).
 */
export function AkhtarWordmark({ size = "hero" }: Props) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();

  const homeMaxWidth = Math.round(Math.min(300, windowWidth * 0.88) * HOME_WORDMARK_SCALE);

  const maxWidth =
    size === "profileSetup"
      ? Math.round(PROFILE_SETUP_WORDMARK_HEIGHT_PX * WORDMARK_ASPECT)
      : size === "hero"
        ? Math.min(340, windowWidth * 0.92)
        : size === "home"
          ? homeMaxWidth
          : size === "authEntry"
            ? Math.min(AUTH_ENTRY_CAP_PX, Math.round(windowWidth * AUTH_ENTRY_MAX_WIDTH_FRAC))
            : size === "dashboard"
              ? Math.round(homeMaxWidth * DASHBOARD_WORDMARK_SCALE)
              : Math.min(HEADER_MAX_WIDTH_PX, windowWidth * HEADER_WIDTH_FRAC);

  const height =
    size === "profileSetup" ? PROFILE_SETUP_WORDMARK_HEIGHT_PX : Math.round(maxWidth / WORDMARK_ASPECT);

  return (
    <View
      className={`items-center justify-center ${
        size === "authEntry" ? "py-1" : size === "profileSetup" ? "py-0" : "py-2"
      }`}
    >
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
