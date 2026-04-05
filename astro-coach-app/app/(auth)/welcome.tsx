import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SignInHeroPanel } from "@/components/auth/SignInHeroPanel";
import { CosmicBackground } from "@/components/CosmicBackground";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { LanguageSelector } from "@/components/LanguageSelector";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { signInWithGoogle } from "@/lib/googleAuth";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { type FC, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";
import { themes, typography } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const WIDE_SPLIT_MIN_WIDTH = 840;
const theme = themes.dark;

type SocialProviderRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled: boolean;
  fixedWidth?: number;
  isWideSplit: boolean;
};

/**
 * Social row: leading icon (start in LTR / RTL), label centered; matches primary CTA width & min height.
 */
const SocialProviderRow: FC<SocialProviderRowProps> = ({ icon, label, onPress, disabled, fixedWidth, isWideSplit }) => (
  <Pressable
    accessibilityRole="button"
    disabled={disabled}
    onPress={onPress}
    className={`min-h-[48px] flex-row items-center rounded-2xl border px-3 py-3 rtl:flex-row-reverse ${!isWideSplit ? "self-center" : "w-full max-w-sm self-center"}`}
    style={{
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surface,
      opacity: disabled ? 0.55 : 1,
      ...(fixedWidth != null ? { width: fixedWidth } : {}),
    }}
  >
    <View className="h-[22px] w-10 items-center justify-center">
      <Ionicons name={icon} size={22} color={theme.colors.onBackground} />
    </View>
    <Text
      className="flex-1 text-center text-base font-semibold"
      style={{ color: theme.colors.onBackground, fontFamily: typography.family.semibold }}
      numberOfLines={1}
    >
      {label}
    </Text>
    <View className="w-10" />
  </Pressable>
);

/**
 * Auth welcome: centered hero cluster (gap-y), bottom-anchored actions (gap-y), explicit primary / secondary / Google.
 */
export default function AuthWelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const rtl = i18n.language === "fa";
  const { user, loading } = useFirebaseAuth();
  const [googleFlowError, setGoogleFlowError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);

  const isWideSplit = width >= WIDE_SPLIT_MIN_WIDTH;
  const narrowCtaWidth = Math.min(width - 48, 320);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const onGoogle = useCallback(async () => {
    setGoogleBusy(true);
    setGoogleFlowError("");
    try {
      const signedInUser = await signInWithGoogle();
      if (signedInUser) {
        await syncAuthUserToBackend(signedInUser);
        router.replace("/");
      }
    } catch (e) {
      console.error("Google sign-in error:", e);
      setGoogleFlowError(t("auth.errors.googleFailed"));
    } finally {
      setGoogleBusy(false);
    }
  }, [router, t]);

  const haptic = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const headlineAlign = {
    textAlign: "center" as const,
    writingDirection: (rtl ? "rtl" : "ltr") as "rtl" | "ltr",
  };

  const langOverlay = (
    <View className="absolute end-3 top-2 z-20" pointerEvents="box-none">
      <LanguageSelector variant="inline" />
    </View>
  );

  const langOverlayLoading = (
    <View
      className="absolute end-3 z-20"
      style={{ top: Math.max(insets.top, 8) + 4 }}
      pointerEvents="box-none"
    >
      <LanguageSelector variant="inline" />
    </View>
  );

  const anyBusy = googleBusy;

  const ctaShellClass = `min-h-[48px] items-center justify-center rounded-2xl px-6 py-3 ${!isWideSplit ? "self-center" : "w-full max-w-sm self-center"}`;
  const ctaWidth = !isWideSplit ? { width: narrowCtaWidth } : {};

  const actionBlock = (
    <View className={`w-full items-center ${isWideSplit ? "gap-y-4" : "gap-y-4"}`}>
      {googleFlowError ? (
        <Text
          className="px-2 text-center text-xs leading-4"
          style={{ color: theme.colors.error, writingDirection: rtl ? "rtl" : "ltr" }}
        >
          {googleFlowError}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={anyBusy}
        onPress={() => {
          haptic();
          router.push("/register");
        }}
        className={ctaShellClass}
        style={{
          backgroundColor: theme.colors.primary,
          opacity: anyBusy ? 0.65 : 1,
          ...ctaWidth,
        }}
      >
        <Text className="text-center text-base font-semibold" style={{ color: theme.colors.onPrimary, fontFamily: typography.family.semibold }}>
          {t("auth.cta_create_your_account")}
        </Text>
      </Pressable>

      <SocialProviderRow
        icon="logo-google"
        label={googleBusy ? t("common.ellipsis") : t("auth.cta_google")}
        onPress={() => {
          haptic();
          if (!googleBusy) void onGoogle();
        }}
        disabled={anyBusy}
        fixedWidth={!isWideSplit ? narrowCtaWidth : undefined}
        isWideSplit={isWideSplit}
      />

      <Text
        className="text-center text-xs leading-4"
        style={{
          fontFamily: typography.family.regular,
          color: theme.colors.onSurfaceVariant,
          writingDirection: rtl ? "rtl" : "ltr",
        }}
      >
        {t("auth.already_have_account")}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("auth.signIn")}
        disabled={anyBusy}
        onPress={() => {
          haptic();
          router.push("/sign-in");
        }}
        className={`${ctaShellClass} border`}
        style={{
          borderColor: theme.colors.outline,
          backgroundColor: theme.colors.surface,
          opacity: anyBusy ? 0.65 : 1,
          ...ctaWidth,
        }}
      >
        <Text className="text-center text-base font-semibold" style={{ color: theme.colors.onBackground, fontFamily: typography.family.semibold }}>
          {t("auth.signIn")}
        </Text>
      </Pressable>
    </View>
  );

  if (loading && !user) {
    return (
      <View className="relative flex-1 items-center justify-center overflow-hidden">
        <CosmicBackground colorSchemeOverride="dark" subtleDrift />
        {langOverlayLoading}
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (isWideSplit) {
    return (
      <SafeAreaView className="relative flex-1 overflow-hidden" edges={["top", "left", "right"]}>
        <CosmicBackground colorSchemeOverride="dark" subtleDrift />
        {langOverlay}
        <View className="flex-1 flex-row" style={{ flexDirection: rtl ? "row-reverse" : "row" }}>
          <View className="min-h-0 flex-1 items-center justify-center px-10 py-5" style={{ maxWidth: 540, width: "100%" }}>
            <View className="w-full max-w-[420px] items-center gap-y-5">
              <AkhtarWordmark size="home" />
              <Text
                className="text-center text-xl font-medium leading-7"
                style={{
                  color: theme.colors.onBackground,
                  fontFamily: typography.family.medium,
                  ...headlineAlign,
                }}
              >
                {t("auth.headline")}
              </Text>
              {actionBlock}
            </View>
          </View>
          <View className="min-w-0 flex-1">
            <SignInHeroPanel theme={theme} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <SafeAreaView className="relative flex-1 overflow-hidden" edges={["top", "left", "right"]}>
      <CosmicBackground colorSchemeOverride="dark" subtleDrift />
      {langOverlay}
      <View className="flex-1 px-4" style={{ paddingBottom: bottomPad }}>
        <View className="flex-1 justify-between" style={{ minHeight: 0 }}>
          <View className="w-full flex-1 items-center justify-center gap-y-5">
            <View className="h-[80px] w-full items-center justify-center overflow-visible">
              <SignInHeroPanel theme={theme} layout="decision" />
            </View>
            <AkhtarWordmark size="authEntry" />
            <Text
              className="px-2 text-center text-lg font-semibold leading-6"
              style={{
                color: theme.colors.onBackground,
                fontFamily: typography.family.semibold,
                maxWidth: width - 32,
                ...headlineAlign,
              }}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {t("auth.headline")}
            </Text>
          </View>

          <View className="w-full shrink-0 items-center pt-8">{actionBlock}</View>
        </View>
      </View>
    </SafeAreaView>
  );
}
