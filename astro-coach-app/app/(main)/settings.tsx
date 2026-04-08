import { useFocusEffect } from "@react-navigation/native";
import { useAuth, type AppUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { CosmicBackground } from "@/components/CosmicBackground";
import { MainTabChromeHeader } from "@/components/MainInPageChrome";
import { fetchUserProfile, type UserProfile } from "@/lib/userProfile";
import { useSubscription } from "@/lib/useSubscription";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { firebaseAuthActions } from "@/providers/FirebaseAuthProvider";
import { useTranslation } from "react-i18next";
import { useThemeColors } from "@/lib/themeColors";
import { useTheme } from "@/providers/ThemeProvider";
import { removePersistedValue } from "@/lib/storage";
import { apiRequest } from "@/lib/api";
import { LANGUAGE_PREF_KEY, type AppLanguage } from "@/lib/i18n";
import { applyLanguage, syncLanguageToBackend } from "@/lib/languageManager";
import { ONBOARDING_COMPLETED_KEY } from "@/lib/onboardingState";
import { restorePurchasesAccess } from "@/lib/purchases";
import { computeTrialDaysLeftClient } from "@/lib/trialUtils";
import type { TFunction } from "i18next";

function SectionHeader({ label }: { label: string }) {
  const tc = useThemeColors();
  return (
    <Text
      className="mb-2 mt-6 px-1 text-xs font-medium uppercase tracking-widest"
      style={{ color: tc.sectionHeading }}
    >
      {label}
    </Text>
  );
}

function isEmailPasswordUser(user: AppUser | null): boolean {
  if (!user) return false;
  return user.providerData.some((p) => p.providerId === "password");
}

function firebaseErrCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return undefined;
}

function mapFirebaseError(t: TFunction, err: unknown): string {
  const code = firebaseErrCode(err);
  if (code === "auth/requires-recent-login") return t("account.errors.requiresRecentLogin");
  if (code === "auth/wrong-password") return t("account.errors.wrongPassword");
  if (code === "auth/email-already-in-use") return t("account.errors.emailInUse");
  if (code === "auth/invalid-email") return t("account.errors.invalidEmail");
  if (code === "auth/weak-password") return t("account.errors.weakPassword");
  return t("account.errors.generic");
}

function getProviderLabel(t: TFunction, providerId: string): string {
  switch (providerId) {
    case "password":
      return t("account.providerEmailPassword");
    case "google.com":
      return t("account.providerGoogle");
    case "apple.com":
      return t("account.providerApple");
    default:
      return t("account.providerOther");
  }
}

function Row({
  label,
  onPress,
  showDivider,
  destructive,
}: {
  label: string;
  onPress: () => void;
  showDivider: boolean;
  destructive?: boolean;
}) {
  const { theme } = useTheme();
  const tc = useThemeColors();
  const fg = destructive ? theme.colors.error : tc.rowLabel;
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[48px] flex-row items-center justify-between px-4 py-3"
      style={{
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: tc.borderSubtle,
      }}
    >
      <Text className="text-lg font-medium" style={{ color: fg }}>
        {label}
      </Text>
      <Text className="text-xl" style={{ color: fg }}>
        ›
      </Text>
    </Pressable>
  );
}

/** Fallback label from cached profile when subscription hook is still loading or failed. */
function buildSubscriptionStatusLabel(profile: UserProfile | null, t: TFunction): string {
  const status = profile?.user?.subscriptionStatus;
  const trialStartedAt = profile?.user?.trialStartedAt;

  if (status === "active") return t("settings.subStatusActive");

  if (status === "trial" && trialStartedAt) {
    const daysLeft = computeTrialDaysLeftClient(trialStartedAt);
    return t("trial.daysLeft", { count: daysLeft });
  }

  if (status === "trial") return t("trial.activeGeneric");
  if (status === "cancelled") return t("settings.subStatusCancelled");
  return t("settings.subStatusFree");
}

export default function SettingsMainScreen() {
  const { t, i18n } = useTranslation();
  const tc = useThemeColors();
  const { theme, isDark, preference, setPreference } = useTheme();
  const { signOut, getToken, user } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const router = useRouter();
  const {
    loading: subLoading,
    refresh: refreshSubscription,
    hasAccess: subHasAccess,
    trialActive: subTrialActive,
    trialDaysLeft: subTrialDaysLeft,
    subscriptionStatus: subStatus,
    trialStartedAt: subTrialStartedAt,
    isPremium: subIsPremium,
    premiumUnlimited: subPremiumUnlimited,
    premiumDaysLeft: subPremiumDaysLeft,
  } = useSubscription();
  const [notifyDaily, setNotifyDaily] = useState(true);
  const [notifyMoon, setNotifyMoon] = useState(false);
  const [currentLang, setCurrentLang] = useState<AppLanguage>(
    (i18n.language === "en" ? "en" : "fa") as AppLanguage,
  );
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [currentPwdForPwd, setCurrentPwdForPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    setCurrentLang((i18n.language === "en" ? "en" : "fa") as AppLanguage);
  }, [i18n.language]);

  useEffect(() => {
    setVerificationSent(false);
    setVerificationError(null);
    setVerificationLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    if (user?.emailVerified) {
      setVerificationSent(false);
      setVerificationError(null);
    }
  }, [user?.emailVerified]);

  const refreshProfileAndSubscription = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      if (!token) return;
      await refreshSubscription();
      const profile = await fetchUserProfile(token, true);
      setUserProfile(profile);
    } catch {
      /* non-fatal */
    }
  }, [refreshSubscription]);

  useEffect(() => {
    void refreshProfileAndSubscription();
  }, [refreshProfileAndSubscription]);

  useFocusEffect(
    useCallback(() => {
      void refreshProfileAndSubscription();
    }, [refreshProfileAndSubscription]),
  );

  const subscriptionStatusLabel = useMemo(() => {
    if (subLoading) return "…";
    if (subPremiumUnlimited) {
      return t("settings.subStatusPremiumLifetime");
    }
    if (subIsPremium && subPremiumDaysLeft !== null) {
      return t("settings.subStatusPremiumDaysLeft", { count: subPremiumDaysLeft });
    }
    if (subIsPremium) {
      return t("settings.subStatusActive");
    }
    if (subTrialActive && subHasAccess) {
      return t("trial.daysLeft", { count: subTrialDaysLeft });
    }
    if (!subHasAccess && subTrialStartedAt) {
      return t("trial.expiredStatus");
    }
    if (subHasAccess && !subTrialActive && !subIsPremium) {
      return t("settings.subStatusPremium");
    }
    return buildSubscriptionStatusLabel(userProfile, t);
  }, [
    subLoading,
    subIsPremium,
    subPremiumUnlimited,
    subPremiumDaysLeft,
    subTrialActive,
    subHasAccess,
    subTrialDaysLeft,
    subTrialStartedAt,
    userProfile,
    t,
  ]);

  const subscriptionRow = useMemo(() => {
    if (subLoading) return null;
    if (subIsPremium || subStatus === "active") {
      return Platform.OS === "web"
        ? { label: t("settings.manageSubscription"), mode: "portal" as const }
        : { label: t("settings.manageSubscription"), mode: "apple" as const };
    }
    // Active trial — user has access but can choose to upgrade early
    if (subTrialActive && subHasAccess) {
      return { label: t("settings.seePremiumPlans"), mode: "paywall" as const };
    }

    // No access — trial expired or free user
    if (!subHasAccess) {
      return { label: t("paywall.unlockCta"), mode: "paywall" as const };
    }
    if (subHasAccess) {
      return Platform.OS === "web"
        ? { label: t("settings.manageSubscription"), mode: "portal" as const }
        : { label: t("settings.manageSubscription"), mode: "apple" as const };
    }
    return { label: t("paywall.unlockCta"), mode: "paywall" as const };
  }, [subLoading, subIsPremium, subStatus, subHasAccess, subTrialActive, t]);

  const handleLanguageChange = async (lang: AppLanguage) => {
    if (lang === currentLang) return;
    setCurrentLang(lang);
    await applyLanguage(lang);
    const ok = await syncLanguageToBackend(lang, getToken);
    if (!ok) {
      console.warn("[settings] language backend sync failed — will retry on next authenticated request");
    }
  };

  const onDelete = async () => {
    const base = process.env.EXPO_PUBLIC_API_URL ?? "";
    const token = await getToken();
    await fetch(`${base}/api/user/account`, { method: "DELETE", headers: { authorization: `Bearer ${token ?? ""}` } }).catch(() => null);
    await signOut();
    await removePersistedValue(LANGUAGE_PREF_KEY);
    await removePersistedValue(ONBOARDING_COMPLETED_KEY);
    router.replace("/(onboarding)/language-select");
  };

  const restore = async () => {
    try {
      if (Platform.OS !== "web") await restorePurchasesAccess();
      Alert.alert(t("settings.restoreDone"));
    } catch {
      Alert.alert(t("settings.restoreFailed"));
    }
  };

  const onSignOut = async () => {
    try {
      await signOut();
      router.replace("/welcome");
    } catch (e) {
      console.warn("[settings] sign out failed", e);
    }
  };

  const providerLabels = useMemo(() => {
    if (!user?.providerData.length) return "";
    const ids = [...new Set(user.providerData.map((p) => p.providerId))];
    return ids.map((id) => getProviderLabel(t, id)).join(", ");
  }, [user, t]);

  const memberSinceFormatted = useMemo(() => {
    if (!user?.creationTime) return null;
    try {
      return new Date(user.creationTime).toLocaleDateString(
        i18n.language.startsWith("fa") ? "fa-IR" : "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      );
    } catch {
      return null;
    }
  }, [user?.creationTime, i18n.language]);

  const handleSendVerification = useCallback(async () => {
    if (!user?.email || user.emailVerified) return;
    setVerificationLoading(true);
    setVerificationError(null);
    try {
      await firebaseAuthActions.sendEmailVerification();
      setVerificationSent(true);
      try {
        await firebaseAuthActions.reload();
      } catch {
        /* reload failure is non-fatal */
      }
    } catch (err: unknown) {
      const code = firebaseErrCode(err);
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
      console.error("[verification] error:", code, message);
      if (code === "auth/too-many-requests") {
        setVerificationError(t("account.verificationTooManyRequests"));
      } else if (code === "auth/user-not-found") {
        setVerificationError(t("account.verificationFailed"));
      } else {
        setVerificationError(message || t("account.verificationFailed"));
      }
    } finally {
      setVerificationLoading(false);
    }
  }, [user, t]);

  const submitPasswordChange = useCallback(async () => {
    if (!user?.email) return;
    if (newPwd !== confirmPwd) {
      Alert.alert(t("account.section"), t("account.errors.passwordMismatch"));
      return;
    }
    if (newPwd.length < 6) {
      Alert.alert(t("account.section"), t("account.errors.weakPassword"));
      return;
    }
    setAccountBusy(true);
    try {
      await firebaseAuthActions.reauthenticateWithPassword(user.email, currentPwdForPwd);
      await firebaseAuthActions.updatePassword(newPwd);
      setPwdModalOpen(false);
      setCurrentPwdForPwd("");
      setNewPwd("");
      setConfirmPwd("");
      Alert.alert(t("account.successPassword"));
    } catch (e) {
      Alert.alert(t("account.section"), mapFirebaseError(t, e));
    } finally {
      setAccountBusy(false);
    }
  }, [user, newPwd, confirmPwd, currentPwdForPwd, t]);

  const toggleAccountExpanded = useCallback(() => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAccountExpanded((open) => !open);
  }, []);

  /** Opaque dim layer + sheet use solid tokens so modal content stays readable on web and native. */
  const accountModalBackdrop = tc.isDark ? "rgba(0,0,0,0.72)" : "rgba(15,23,42,0.55)";
  const accountSheetStyle = useMemo(
    () => ({
      backgroundColor: tc.sheetBackground,
      borderTopWidth: 1 as const,
      borderColor: tc.border,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
    }),
    [tc.border, tc.sheetBackground],
  );

  const accountInputStyle = useMemo(
    () => ({
      borderWidth: 1 as const,
      borderColor: tc.border,
      color: tc.textPrimary,
      backgroundColor: tc.isDark ? "rgba(255,255,255,0.08)" : "#ffffff",
      minHeight: 56,
      borderRadius: 4,
      paddingHorizontal: 16,
      paddingVertical: 16,
    }),
    [tc.border, tc.isDark, tc.textPrimary],
  );

  /**
   * Calls POST /api/billing/portal.
   * - If user has a Stripe account → opens Stripe Customer Portal.
   * - If user has no Stripe account → navigates to the unified paywall.
   * Native users are sent to Apple's subscription management page instead.
   */
  const handleManageSubscription = async () => {
    setSubscriptionLoading(true);
    try {
      const idToken = await getToken();
      if (!idToken) return;

      const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/api/billing/portal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = (await res.json()) as {
        hasStripeAccount?: boolean;
        portalUrl?: string;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? "Request failed");

      if (data.hasStripeAccount && data.portalUrl) {
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.location.href = data.portalUrl;
        } else {
          await Linking.openURL(data.portalUrl);
        }
      } else {
        router.push("/(subscription)/paywall" as Href);
      }
    } catch (err) {
      console.error("[settings] manage subscription error:", err);
      Alert.alert("Error", "Could not open subscription management. Please try again.");
    } finally {
      setSubscriptionLoading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "transparent" }}>
      <CosmicBackground subtleDrift />
      <View className="flex-1 px-4 pb-10">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <MainTabChromeHeader leadingAction="back" />
        <Text className="mb-2 pt-2 text-center text-3xl font-semibold" style={{ color: tc.textPrimary }}>
          {t("settings.title")}
        </Text>

        <SectionHeader label={t("settings.sectionProfile")} />
        <View
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: tc.border, backgroundColor: tc.rowGroupBackground }}
        >
          <Row
            label={t("settings.editInfo")}
            onPress={() => router.push("/(main)/edit-profile")}
            showDivider
          />
          {user ? (
            <>
              <Pressable
                onPress={toggleAccountExpanded}
                className="min-h-[48px] flex-row items-center justify-between px-4 py-3"
                style={{
                  borderBottomWidth: accountExpanded ? 0 : 1,
                  borderBottomColor: tc.borderSubtle,
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: accountExpanded }}
              >
                <View className="min-w-0 flex-1 pr-3">
                  <Text className="text-lg font-medium" style={{ color: tc.rowLabel }}>
                    {t("settings.accountRowTitle", { defaultValue: "Account" })}
                  </Text>
                  <Text className="mt-0.5 text-sm" style={{ color: tc.textSecondary }}>
                    {t("settings.accountRowSubtitle", { defaultValue: "Email & Password" })}
                  </Text>
                </View>
                <Text className="text-xl" style={{ color: tc.iconSecondary }}>
                  {accountExpanded ? "▾" : "›"}
                </Text>
              </Pressable>
              {accountExpanded ? (
                <View
                  style={{
                    backgroundColor: tc.surfaceSecondary,
                    borderBottomWidth: 1,
                    borderBottomColor: tc.borderSubtle,
                  }}
                >
                  <Pressable
                    onPress={
                      user.email && !user.emailVerified && !verificationSent && !verificationLoading
                        ? () => void handleSendVerification()
                        : undefined
                    }
                    disabled={
                      verificationLoading ||
                      verificationSent ||
                      user.emailVerified ||
                      !user.email
                    }
                    className="min-h-[48px] px-4 py-3"
                    style={{ borderBottomWidth: 1, borderBottomColor: tc.borderSubtle }}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled:
                        verificationLoading ||
                        verificationSent ||
                        user.emailVerified ||
                        !user.email,
                    }}
                  >
                    <Text className="text-sm" style={{ color: tc.textSecondary }}>
                      {t("account.email")}
                    </Text>
                    <View className="mt-1 flex-row flex-wrap items-start justify-between gap-x-2 gap-y-1">
                      <Text
                        className="min-w-0 flex-1 text-lg"
                        style={{ color: tc.textPrimary }}
                      >
                        {user.email ?? t("account.emailNotSet")}
                      </Text>
                      <View className="min-h-[48px] shrink-0 items-end justify-center">
                        {user.emailVerified ? (
                          <Text
                            className="text-xs font-medium"
                            style={{ color: theme.colors.success }}
                          >
                            {t("account.verified")}
                          </Text>
                        ) : verificationSent ? (
                          <Text
                            className="text-xs font-medium"
                            style={{ color: theme.colors.primary }}
                          >
                            {t("account.emailSent")}
                          </Text>
                        ) : verificationLoading ? (
                          <ActivityIndicator size="small" color={theme.colors.primary} />
                        ) : (
                          <Text
                            className="text-xs font-medium"
                            style={{ color: theme.colors.warning }}
                          >
                            {t("account.unverified")}
                          </Text>
                        )}
                      </View>
                    </View>
                    {!user.emailVerified && !verificationSent && !verificationLoading && user.email ? (
                      <Text className="mt-1 text-[11px] leading-4" style={{ color: tc.textTertiary }}>
                        {t("account.tapToVerify")}
                      </Text>
                    ) : null}
                    {verificationSent && !user.emailVerified ? (
                      <Text className="mt-1 text-[11px] leading-4" style={{ color: tc.textTertiary }}>
                        {t("account.checkInbox")}
                      </Text>
                    ) : null}
                    {verificationError ? (
                      <Text className="mt-1 text-[11px] leading-4" style={{ color: theme.colors.error }}>
                        {verificationError}
                      </Text>
                    ) : null}
                  </Pressable>
                  {user.phoneNumber ? (
                    <View
                      className="min-h-[48px] justify-center px-4 py-3"
                      style={{ borderBottomWidth: 1, borderBottomColor: tc.borderSubtle }}
                    >
                      <Text className="text-sm" style={{ color: tc.textSecondary }}>
                        {t("account.phone")}
                      </Text>
                      <Text className="mt-1 text-lg" style={{ color: tc.textPrimary }}>
                        {user.phoneNumber}
                      </Text>
                    </View>
                  ) : null}
                  <View
                    className="min-h-[48px] justify-center px-4 py-3"
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: tc.borderSubtle,
                    }}
                  >
                    <Text className="text-sm" style={{ color: tc.textSecondary }}>
                      {t("account.signInMethods")}
                    </Text>
                    <Text className="mt-1 text-lg" style={{ color: tc.textPrimary }}>
                      {providerLabels || "—"}
                    </Text>
                  </View>
                  {memberSinceFormatted ? (
                    <View
                      className="min-h-[48px] justify-center px-4 py-3"
                      style={{
                        borderBottomWidth: 1,
                        borderBottomColor: tc.borderSubtle,
                      }}
                    >
                      <Text className="text-sm" style={{ color: tc.textSecondary }}>
                        {t("account.memberSince")}
                      </Text>
                      <Text className="mt-1 text-lg" style={{ color: tc.textPrimary }}>
                        {memberSinceFormatted}
                      </Text>
                    </View>
                  ) : null}
                  {isEmailPasswordUser(user) ? (
                    <Row
                      label={t("account.changePassword")}
                      onPress={() => setPwdModalOpen(true)}
                      showDivider={false}
                    />
                  ) : (
                    <View className="px-4 py-4">
                      <Text className="text-base leading-6" style={{ color: tc.textSecondary }}>
                        {t("account.oauthManagedHint")}
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}
            </>
          ) : null}
          <Row label={t("settings.signOut")} onPress={() => void onSignOut()} showDivider={false} />
        </View>

        <SectionHeader label={t("settings.sectionSubscription")} />
        <Text
          className="mb-2 px-1 text-sm"
          style={{ color: tc.textSecondary }}
        >
          {subLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            subscriptionStatusLabel
          )}
        </Text>
        <View
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: tc.border, backgroundColor: tc.rowGroupBackground }}
        >
          {subscriptionRow ? (
            <Row
              label={subscriptionLoading ? "Loading…" : subscriptionRow.label}
              onPress={() => {
                if (subscriptionLoading) return;
                if (subscriptionRow.mode === "portal") {
                  void handleManageSubscription();
                  return;
                }
                if (subscriptionRow.mode === "apple") {
                  void Linking.openURL("https://apps.apple.com/account/subscriptions");
                  return;
                }
                router.push("/(subscription)/paywall" as Href);
              }}
              showDivider={Platform.OS !== "web"}
            />
          ) : (
            <View className="px-4 py-4">
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          )}
          {Platform.OS !== "web" ? (
            <Row label={t("settings.restorePurchases")} onPress={() => void restore()} showDivider={false} />
          ) : null}
        </View>

        <SectionHeader label={t("settings.notifications")} />
        <View
          className="overflow-hidden rounded-xl border px-4 py-4"
          style={{ borderColor: tc.border, backgroundColor: tc.rowGroupBackground }}
        >
          <View className="min-h-[48px] flex-row items-center justify-between py-2">
            <Text className="flex-1 pr-4 text-lg" style={{ color: tc.textPrimary }}>
              {t("settings.notificationsDaily")}
            </Text>
            <Switch
              value={notifyDaily}
              onValueChange={setNotifyDaily}
              trackColor={{ true: theme.colors.primary, false: theme.colors.outlineVariant }}
              thumbColor={tc.textPrimary}
            />
          </View>
          <View className="h-px w-full" style={{ backgroundColor: tc.borderSubtle }} />
          <View className="min-h-[48px] flex-row items-center justify-between py-2">
            <Text className="flex-1 pr-4 text-lg" style={{ color: tc.textPrimary }}>
              {t("settings.moonAlerts")}
            </Text>
            <Switch
              value={notifyMoon}
              onValueChange={setNotifyMoon}
              trackColor={{ true: theme.colors.primary, false: theme.colors.outlineVariant }}
              thumbColor={tc.textPrimary}
            />
          </View>
        </View>

        <SectionHeader label={t("settings.sectionAppearance")} />
        <View
          className="overflow-hidden rounded-xl border px-4 py-4"
          style={{ borderColor: tc.border, backgroundColor: tc.rowGroupBackground }}
        >
          <View className="min-h-[48px] flex-row items-center justify-between">
            <Text className="text-lg" style={{ color: tc.textPrimary }}>
              {t("settings.language")}
            </Text>
            <View
              className="flex-row rounded-xl p-1"
              style={{ backgroundColor: theme.colors.surfaceVariant }}
            >
              {(["en", "fa"] as const).map((lang) => {
                const isActive = currentLang === lang;
                return (
                  <Pressable
                    key={lang}
                    onPress={() => void handleLanguageChange(lang)}
                    className="min-h-[48px] min-w-[64px] items-center justify-center rounded-[20px] px-3 py-2"
                    style={{
                      backgroundColor: isActive ? theme.colors.primary : "transparent",
                    }}
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{
                        color: isActive ? (theme.colors.onPrimary ?? "#fff") : theme.colors.onSurfaceVariant,
                      }}
                    >
                      {lang === "en" ? t("language.english") : t("language.farsi")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View className="my-2 h-px w-full" style={{ backgroundColor: tc.borderSubtle }} />
          <View className="min-h-[48px] flex-row items-center justify-between">
            <Text className="text-lg" style={{ color: tc.textPrimary }}>
              {isDark ? t("settings.dark") : t("settings.light")}
            </Text>
            <Switch
              value={isDark}
              onValueChange={() => void setPreference(isDark ? "light" : "dark")}
              trackColor={{ true: theme.colors.primary, false: theme.colors.outlineVariant }}
              thumbColor={tc.textPrimary}
            />
          </View>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {(["system", "light", "dark"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => void setPreference(mode)}
                className="min-h-[48px] justify-center rounded-[20px] border px-3 py-2"
                style={{
                  borderColor: preference === mode ? theme.colors.primary : tc.border,
                  backgroundColor: preference === mode ? theme.colors.primaryContainer : "transparent",
                }}
              >
                <Text className="text-sm font-medium" style={{ color: tc.textPrimary }}>
                  {mode === "system" ? t("settings.system") : mode === "light" ? t("settings.light") : t("settings.dark")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <SectionHeader label={t("settings.sectionSupport")} />
        <View
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: tc.border, backgroundColor: tc.rowGroupBackground }}
        >
          <Row
            label={t("settings.contact")}
            onPress={() => void Linking.openURL("mailto:astracontact111@gmail.com")}
            showDivider
          />
          <Row label={t("settings.shareDebug")} onPress={() => void Linking.openURL("mailto:astracontact111@gmail.com?subject=Debug")} showDivider={false} />
        </View>

        <SectionHeader label={t("settings.sectionLegal")} />
        <View
          className="overflow-hidden rounded-xl border"
          style={{ borderColor: tc.border, backgroundColor: tc.rowGroupBackground }}
        >
          <Row
            label={t("settings.terms")}
            onPress={() => void WebBrowser.openBrowserAsync("https://example.com/terms")}
            showDivider
          />
          <Row label={t("settings.privacy")} onPress={() => void WebBrowser.openBrowserAsync("https://example.com/privacy")} showDivider={false} />
        </View>

        <View className="mt-6 overflow-hidden rounded-xl border" style={{ borderColor: theme.colors.error }}>
          <Row label={t("settings.deleteAccount")} onPress={() => void onDelete()} showDivider={false} destructive />
        </View>
        </ScrollView>

        <Modal
          visible={pwdModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => {
            if (!accountBusy) setPwdModalOpen(false);
          }}
        >
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: accountModalBackdrop }}>
            <Pressable
              style={{ flex: 1 }}
              disabled={accountBusy}
              onPress={() => {
                if (accountBusy) return;
                setPwdModalOpen(false);
                setCurrentPwdForPwd("");
                setNewPwd("");
                setConfirmPwd("");
              }}
              accessibilityLabel={t("account.cancel")}
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ width: "100%" }}
            >
              <SafeAreaView edges={["bottom"]} style={accountSheetStyle}>
                <Text className="mb-2 text-xl font-semibold" style={{ color: tc.textPrimary }}>
                  {t("account.modalPasswordTitle")}
                </Text>
                <Text className="text-sm" style={{ color: tc.textSecondary }}>
                  {t("account.modalPasswordCurrent")}
                </Text>
                <TextInput
                  value={currentPwdForPwd}
                  onChangeText={setCurrentPwdForPwd}
                  secureTextEntry
                  editable={!accountBusy}
                  placeholderTextColor={tc.textSecondary}
                  className="mt-1 text-base"
                  style={accountInputStyle}
                />
                <Text className="mt-2 text-sm" style={{ color: tc.textSecondary }}>
                  {t("account.modalPasswordNew")}
                </Text>
                <TextInput
                  value={newPwd}
                  onChangeText={setNewPwd}
                  secureTextEntry
                  editable={!accountBusy}
                  placeholderTextColor={tc.textSecondary}
                  className="mt-1 text-base"
                  style={accountInputStyle}
                />
                <Text className="mt-2 text-sm" style={{ color: tc.textSecondary }}>
                  {t("account.modalPasswordConfirm")}
                </Text>
                <TextInput
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                  secureTextEntry
                  editable={!accountBusy}
                  placeholderTextColor={tc.textSecondary}
                  className="mt-1 text-base"
                  style={accountInputStyle}
                />
                <View className="mt-6 flex-row gap-2">
                  <View className="min-h-[48px] flex-1">
                    <Button
                      title={t("account.cancel")}
                      variant="secondary"
                      disabled={accountBusy}
                      onPress={() => {
                        setPwdModalOpen(false);
                        setCurrentPwdForPwd("");
                        setNewPwd("");
                        setConfirmPwd("");
                      }}
                    />
                  </View>
                  <View className="min-h-[48px] flex-1">
                    <Button
                      title={t("account.save")}
                      disabled={accountBusy}
                      onPress={() => void submitPasswordChange()}
                    />
                  </View>
                </View>
              </SafeAreaView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </View>
  );
}
