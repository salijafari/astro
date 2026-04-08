import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { CosmicBackground } from "@/components/CosmicBackground";
import { AkhtarWordmark } from "@/components/brand/AkhtarWordmark";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { signInWithFacebook } from "@/lib/facebookAuth";
import { signInWithGoogle } from "@/lib/googleAuth";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState, type FC } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFirebaseAuth } from "@/providers/FirebaseAuthProvider";
import { themes, typography } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const theme = themes.dark;

/**
 * Facebook web sign-in (Firebase popup). Native stays hidden in `FacebookWebLoginSection` via `Platform.OS === "web"`.
 */
const SHOW_FACEBOOK_WEB_LOGIN = true;

type AuthOptionsMode = "login" | "register";

type FacebookWebLoginSectionProps = {
  narrowCtaWidth: number;
  appLng: string;
  textAlignStyle: { textAlign: "right" | "left"; writingDirection: "rtl" | "ltr" };
  googleBusy: boolean;
  onFacebookBusyChange: (busy: boolean) => void;
};

const FacebookWebLoginSection: FC<FacebookWebLoginSectionProps> = ({
  narrowCtaWidth,
  appLng,
  textAlignStyle,
  googleBusy,
  onFacebookBusyChange,
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [facebookBusy, setFacebookBusy] = useState(false);
  const [facebookFlowError, setFacebookFlowError] = useState("");

  useEffect(() => {
    onFacebookBusyChange(SHOW_FACEBOOK_WEB_LOGIN && Platform.OS === "web" ? facebookBusy : false);
  }, [facebookBusy, onFacebookBusyChange]);

  const onFacebook = useCallback(async () => {
    setFacebookBusy(true);
    setFacebookFlowError("");
    try {
      const signedInUser = await signInWithFacebook();
      if (signedInUser) {
        await syncAuthUserToBackend(signedInUser);
        router.replace("/");
      }
    } catch (e: unknown) {
      console.error("Facebook sign-in error:", e);
      const msg = e instanceof Error ? e.message : "";
      if (msg === "auth/account-exists-with-different-credential") {
        setFacebookFlowError(t("auth.facebookAccountExists"));
      } else {
        setFacebookFlowError(t("auth.facebookError"));
      }
    } finally {
      setFacebookBusy(false);
    }
  }, [router, t]);

  const haptic = () => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  if (!SHOW_FACEBOOK_WEB_LOGIN || Platform.OS !== "web") return null;

  const anyBusy = googleBusy || facebookBusy;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={anyBusy}
        onPress={() => {
          haptic();
          if (!facebookBusy) void onFacebook();
        }}
        className="min-h-[48px] w-full flex-row items-center rounded-2xl border px-3 py-3 rtl:flex-row-reverse"
        style={{
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
          opacity: anyBusy ? 0.55 : 1,
          maxWidth: narrowCtaWidth,
        }}
      >
        <View className="h-[22px] w-10 items-center justify-center">
          <Ionicons name="logo-facebook" size={22} color="#1877F2" />
        </View>
        <Text
          className="flex-1 text-center text-base font-semibold"
          style={{ color: theme.colors.onBackground, fontFamily: typography.family.semibold }}
          numberOfLines={1}
        >
          {facebookBusy ? t("common.ellipsis") : t("auth.cta_facebook", { lng: appLng })}
        </Text>
        <View className="w-10" />
      </Pressable>

      {facebookFlowError ? (
        <Text
          className="w-full px-2 text-center text-sm leading-5"
          style={{ color: theme.colors.error, maxWidth: narrowCtaWidth, ...textAlignStyle }}
        >
          {facebookFlowError}
        </Text>
      ) : null}
    </>
  );
};

const parseModeParam = (raw: string | string[] | undefined): AuthOptionsMode => {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "register" ? "register" : "login";
};

/**
 * Method picker: Google, optional Facebook (web when enabled), phone, or email. Same layout shell as `sign-in.tsx`.
 */
export default function AuthOptionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const rtl = (i18n.language ?? "en").startsWith("fa");
  const appLng = rtl ? "fa" : "en";
  const { user, loading } = useFirebaseAuth();
  const [mode, setMode] = useState<AuthOptionsMode>(() => parseModeParam(params.mode));
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleFlowError, setGoogleFlowError] = useState("");
  const [facebookBusy, setFacebookBusy] = useState(false);

  const narrowCtaWidth = Math.min(width - 48, 320);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    setMode(parseModeParam(params.mode));
  }, [params.mode]);

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

  const textAlignStyle = {
    textAlign: (rtl ? "right" : "left") as "right" | "left",
    writingDirection: (rtl ? "rtl" : "ltr") as "rtl" | "ltr",
  };

  const anyBusy = googleBusy || facebookBusy;

  if (loading && !user) {
    return (
      <View className="relative flex-1 items-center justify-center overflow-hidden">
        <CosmicBackground colorSchemeOverride="dark" subtleDrift />
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView className="relative flex-1 overflow-hidden" edges={["top", "left", "right"]}>
      <CosmicBackground colorSchemeOverride="dark" subtleDrift />
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: Math.max(insets.bottom, 20),
          paddingTop: 8,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptic();
            router.back();
          }}
          className="mb-2 min-h-[44px] flex-row items-center gap-2 py-2"
          hitSlop={8}
          style={{ flexDirection: rtl ? "row-reverse" : "row" }}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.primary} style={{ transform: [{ scaleX: rtl ? -1 : 1 }] }} />
          <Text className="text-base font-semibold" style={{ color: theme.colors.primary, fontFamily: typography.family.semibold }}>
            {t("common.back")}
          </Text>
        </Pressable>

        <View style={{ flexGrow: 1, justifyContent: "center", paddingVertical: 12, minHeight: 120 }}>
          <View style={{ width: "100%", maxWidth: 400, alignSelf: "center" }}>
            <View className="mb-6 items-center">
              <AkhtarWordmark size="home" />
            </View>

            <Text
              className="mb-6 self-center text-2xl font-semibold"
              style={{
                width: "100%",
                maxWidth: narrowCtaWidth,
                textAlign: "center",
                color: theme.colors.onBackground,
                fontFamily: typography.family.semibold,
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            >
              {mode === "register" ? t("auth.createAccount") : t("auth.signIn")}
            </Text>

            <View className="w-full items-center gap-4">
              {googleFlowError ? (
                <Text
                  className="px-2 text-center text-sm leading-5"
                  style={{ color: theme.colors.error, ...textAlignStyle }}
                >
                  {googleFlowError}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={anyBusy}
                onPress={() => {
                  haptic();
                  if (!googleBusy) void onGoogle();
                }}
                className="min-h-[48px] w-full flex-row items-center rounded-2xl border px-3 py-3 rtl:flex-row-reverse"
                style={{
                  borderColor: theme.colors.outlineVariant,
                  backgroundColor: theme.colors.surface,
                  opacity: anyBusy ? 0.55 : 1,
                  maxWidth: narrowCtaWidth,
                }}
              >
                <View className="h-[22px] w-10 items-center justify-center">
                  <Ionicons name="logo-google" size={22} color={theme.colors.onBackground} />
                </View>
                <Text
                  className="flex-1 text-center text-base font-semibold"
                  style={{ color: theme.colors.onBackground, fontFamily: typography.family.semibold }}
                  numberOfLines={1}
                >
                  {googleBusy ? t("common.ellipsis") : t("auth.cta_google", { lng: appLng })}
                </Text>
                <View className="w-10" />
              </Pressable>

              <FacebookWebLoginSection
                narrowCtaWidth={narrowCtaWidth}
                appLng={appLng}
                textAlignStyle={textAlignStyle}
                googleBusy={googleBusy}
                onFacebookBusyChange={setFacebookBusy}
              />

              <Pressable
                accessibilityRole="button"
                disabled={anyBusy}
                onPress={() => {
                  haptic();
                  if (!anyBusy) router.push("/phone-sign-in");
                }}
                className="min-h-[48px] w-full flex-row items-center rounded-2xl border px-3 py-3 rtl:flex-row-reverse"
                style={{
                  borderColor: theme.colors.outlineVariant,
                  backgroundColor: theme.colors.surfaceVariant,
                  opacity: anyBusy ? 0.55 : 1,
                  maxWidth: narrowCtaWidth,
                }}
              >
                <View className="h-[22px] w-10 items-center justify-center">
                  <Ionicons name="call-outline" size={22} color={theme.colors.onBackground} />
                </View>
                <Text
                  className="flex-1 text-center text-base font-semibold"
                  style={{ color: theme.colors.onBackground, fontFamily: typography.family.semibold }}
                  numberOfLines={1}
                >
                  {t("auth.cta_phone", { lng: appLng })}
                </Text>
                <View className="w-10" />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={anyBusy}
                onPress={() => {
                  haptic();
                  if (!anyBusy) {
                    router.push({
                      pathname: "/sign-in",
                      params: { mode: mode === "register" ? "register" : "login" },
                    });
                  }
                }}
                className="min-h-[48px] w-full flex-row items-center justify-center rounded-2xl px-5 py-3 rtl:flex-row-reverse"
                style={{
                  backgroundColor: theme.colors.primary,
                  opacity: anyBusy ? 0.65 : 1,
                  maxWidth: narrowCtaWidth,
                }}
              >
                <View className="h-[22px] w-10 items-center justify-center">
                  <Ionicons name="mail-outline" size={22} color={theme.colors.onPrimary} />
                </View>
                <Text
                  className="flex-1 text-center text-base font-semibold"
                  style={{ color: theme.colors.onPrimary, fontFamily: typography.family.semibold }}
                  numberOfLines={1}
                >
                  {t("auth.cta_email", { lng: appLng })}
                </Text>
                <View className="w-10" />
              </Pressable>

              {/* Additional auth providers can be added here */}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
