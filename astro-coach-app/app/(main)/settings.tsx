import { useFocusEffect } from "@react-navigation/native";
import { useAuth, type AppUser } from "@/lib/auth";
import { syncAuthUserToBackend } from "@/lib/authSync";
import { Button } from "@/components/ui/Button";
import { CosmicBackground } from "@/components/CosmicBackground";
import { PaywallGate } from "@/components/PaywallGate";
import { fetchUserProfile, invalidateProfileCache, type UserProfile } from "@/lib/userProfile";
import { useSubscription } from "@/lib/useSubscription";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
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
import { LANGUAGE_PREF_KEY, changeLanguage, type AppLanguage } from "@/lib/i18n";
import { ONBOARDING_COMPLETED_KEY } from "@/lib/onboardingState";
import { restorePurchasesAccess } from "@/lib/purchases";
import { computeTrialDaysLeftClient } from "@/lib/trialUtils";
import type { TFunction } from "i18next";

function SectionHeader({ label }: { label: string }) {
  const tc = useThemeColors();
  return (
    <Text
      className="mb-2 mt-8 px-1 text-xs font-medium uppercase tracking-widest"
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
      className="min-h-[52px] flex-row items-center justify-between px-4 py-3"
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
  } = useSubscription();
  const [notifyDaily, setNotifyDaily] = useState(true);
  const [notifyMoon, setNotifyMoon] = useState(false);
  const [currentLang, setCurrentLang] = useState<AppLanguage>(
    (i18n.language === "en" ? "en" : "fa") as AppLanguage,
  );
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [settingsPaywallOpen, setSettingsPaywallOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [currentPwdForPwd, setCurrentPwdForPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPwdForEmail, setCurrentPwdForEmail] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    setCurrentLang((i18n.language === "en" ? "en" : "fa") as AppLanguage);
  }, [i18n.language]);

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
    if (subStatus === "active") return t("settings.subStatusActive");
    if (subTrialActive && subHasAccess) {
      return t("trial.daysLeft", { count: subTrialDaysLeft });
    }
    if (!subHasAccess && subTrialStartedAt) return t("trial.expiredStatus");
    if (subHasAccess && !subTrialActive && subStatus !== "active") {
      return t("settings.subStatusPremium");
    }
    return buildSubscriptionStatusLabel(userProfile, t);
  }, [subLoading, subStatus, subTrialActive, subHasAccess, subTrialDaysLeft, subTrialStartedAt, userProfile, t]);

  const subscriptionRow = useMemo(() => {
    if (subLoading) return null;
    if (subStatus === "active") {
      return Platform.OS === "web"
        ? { label: t("settings.manageSubscription"), mode: "portal" as const }
        : { label: t("settings.manageSubscription"), mode: "apple" as const };
    }
    if (subTrialActive && subHasAccess) {
      return { label: t("paywall.unlockCta"), mode: "paywall" as const };
    }
    if (!subHasAccess) {
      return { label: t("paywall.unlockCta"), mode: "paywall" as const };
    }
    if (Platform.OS !== "web") {
      return { label: t("settings.manageSubscription"), mode: "apple" as const };
    }
    return { label: t("settings.manageSubscription"), mode: "portal" as const };
  }, [subLoading, subStatus, subHasAccess, subTrialActive, t]);

  const handleLanguageChange = async (lang: AppLanguage) => {
    if (lang === currentLang) return;
    setCurrentLang(lang);
    await changeLanguage(lang);
    try {
      const langRes = await apiRequest("/api/user/language", {
        method: "PUT",
        getToken,
        body: JSON.stringify({ language: lang }),
      });
      if (langRes.ok) {
        await apiRequest("/api/transits/cache", { method: "DELETE", getToken }).catch((e) => {
          console.warn("[settings] transit cache DELETE failed:", e);
        });
        console.log("[settings] transit cache cleared after language change");
      }
    } catch (err) {
      console.warn("[settings] language sync error:", err);
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
      router.replace("/(auth)/sign-in");
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
    if (!user?.email) return;
    setAccountBusy(true);
    try {
      await firebaseAuthActions.sendEmailVerification();
      Alert.alert(t("account.verificationSent"));
    } catch (e) {
      Alert.alert(t("account.section"), mapFirebaseError(t, e));
    } finally {
      setAccountBusy(false);
    }
  }, [user?.email, t]);

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

  const submitEmailChange = useCallback(async () => {
    if (!user?.email) return;
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      Alert.alert(t("account.section"), t("account.errors.invalidEmail"));
      return;
    }
    setAccountBusy(true);
    try {
      await firebaseAuthActions.reauthenticateWithPassword(user.email, currentPwdForEmail);
      const res = await apiRequest("/api/user/profile", {
        method: "PUT",
        getToken,
        body: JSON.stringify({ email: trimmed }),
      });
      if (res.status === 409) {
        Alert.alert(t("account.section"), t("account.errors.emailInUse"));
        return;
      }
      if (!res.ok) {
        Alert.alert(t("account.section"), t("account.errors.generic"));
        return;
      }
      await firebaseAuthActions.updateEmail(trimmed);
      await firebaseAuthActions.reload();
      void syncAuthUserToBackend().catch(() => {});
      await invalidateProfileCache();
      void refreshProfileAndSubscription();
      setEmailModalOpen(false);
      setNewEmail("");
      setCurrentPwdForEmail("");
      Alert.alert(t("account.successEmail"));
    } catch (e) {
      Alert.alert(t("account.section"), mapFirebaseError(t, e));
    } finally {
      setAccountBusy(false);
    }
  }, [user, newEmail, currentPwdForEmail, getToken, t, refreshProfileAndSubscription]);

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
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 16,
    }),
    [tc.border, tc.sheetBackground],
  );

  const accountInputStyle = useMemo(
    () => ({
      borderColor: tc.border,
      color: tc.textPrimary,
      backgroundColor: tc.isDark ? "rgba(255,255,255,0.08)" : "#ffffff",
    }),
    [tc.border, tc.isDark, tc.textPrimary],
  );

  /**
   * Calls POST /api/billing/portal.
   * - If user has a Stripe account → opens Stripe Customer Portal.
   * - If user has no Stripe account → navigates to the subscribe screen.
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
        router.push("/(subscription)/subscribe");
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
      <CosmicBackground />
      <View className="flex-1 px-4 pb-10">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text className="mb-2 pt-2 text-center text-3xl font-semibold" style={{ color: tc.textPrimary }}>
          {t("settings.title")}
        </Text>

        <SectionHeader label={t("settings.sectionProfile")} />
        <View
          className="overflow-hidden rounded-2xl border"
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
                className="min-h-[52px] flex-row items-center justify-between px-4 py-3"
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
                  <View
                    className="min-h-[52px] justify-center px-4 py-3"
                    style={{ borderBottomWidth: 1, borderBottomColor: tc.borderSubtle }}
                  >
                    <Text className="text-sm" style={{ color: tc.textSecondary }}>
                      {t("account.email")}
                    </Text>
                    <Text className="mt-1 text-lg" style={{ color: tc.textPrimary }}>
                      {user.email ?? t("account.emailNotSet")}
                    </Text>
                  </View>
                  <View
                    className="min-h-[52px] px-4 py-3"
                    style={{ borderBottomWidth: 1, borderBottomColor: tc.borderSubtle }}
                  >
                    <Text className="text-sm" style={{ color: tc.textSecondary }}>
                      {t("account.status")}
                    </Text>
                    <View className="mt-1 flex-row flex-wrap items-center justify-between gap-y-2">
                      <Text
                        className="text-lg font-medium"
                        style={{
                          color: user.emailVerified ? theme.colors.success : theme.colors.warning,
                        }}
                      >
                        {user.emailVerified ? t("account.verified") : t("account.unverified")}
                      </Text>
                      {!user.emailVerified && user.email ? (
                        <Pressable
                          disabled={accountBusy}
                          onPress={() => void handleSendVerification()}
                          className="min-h-[44px] justify-center"
                          accessibilityRole="button"
                        >
                          <Text className="text-sm font-medium" style={{ color: theme.colors.primary }}>
                            {t("account.tapToVerify")}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {user.phoneNumber ? (
                    <View
                      className="min-h-[52px] justify-center px-4 py-3"
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
                    className="min-h-[52px] justify-center px-4 py-3"
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
                      className="min-h-[52px] justify-center px-4 py-3"
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
                    <>
                      <Row
                        label={t("account.changePassword")}
                        onPress={() => setPwdModalOpen(true)}
                        showDivider
                      />
                      <Row
                        label={t("account.changeEmail")}
                        onPress={() => {
                          setNewEmail(user.email ?? "");
                          setEmailModalOpen(true);
                        }}
                        showDivider={false}
                      />
                    </>
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
          className="overflow-hidden rounded-2xl border"
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
                setSettingsPaywallOpen(true);
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
          className="overflow-hidden rounded-2xl border px-4 py-3"
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
          className="overflow-hidden rounded-2xl border px-4 py-4"
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
                    className="min-h-[36px] min-w-[64px] items-center justify-center rounded-lg px-3 py-2"
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
          <View className="my-3 h-px w-full" style={{ backgroundColor: tc.borderSubtle }} />
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
          <View className="mt-3 flex-row flex-wrap gap-2">
            {(["system", "light", "dark"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => void setPreference(mode)}
                className="rounded-full border px-3 py-2"
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
          className="overflow-hidden rounded-2xl border"
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
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: tc.border, backgroundColor: tc.rowGroupBackground }}
        >
          <Row
            label={t("settings.terms")}
            onPress={() => void WebBrowser.openBrowserAsync("https://example.com/terms")}
            showDivider
          />
          <Row label={t("settings.privacy")} onPress={() => void WebBrowser.openBrowserAsync("https://example.com/privacy")} showDivider={false} />
        </View>

        <View className="mt-10 overflow-hidden rounded-2xl border" style={{ borderColor: theme.colors.error }}>
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
                <Text className="mb-3 text-xl font-semibold" style={{ color: tc.textPrimary }}>
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
                  className="mt-1 rounded-xl border px-3 py-3 text-base"
                  style={accountInputStyle}
                />
                <Text className="mt-3 text-sm" style={{ color: tc.textSecondary }}>
                  {t("account.modalPasswordNew")}
                </Text>
                <TextInput
                  value={newPwd}
                  onChangeText={setNewPwd}
                  secureTextEntry
                  editable={!accountBusy}
                  placeholderTextColor={tc.textSecondary}
                  className="mt-1 rounded-xl border px-3 py-3 text-base"
                  style={accountInputStyle}
                />
                <Text className="mt-3 text-sm" style={{ color: tc.textSecondary }}>
                  {t("account.modalPasswordConfirm")}
                </Text>
                <TextInput
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                  secureTextEntry
                  editable={!accountBusy}
                  placeholderTextColor={tc.textSecondary}
                  className="mt-1 rounded-xl border px-3 py-3 text-base"
                  style={accountInputStyle}
                />
                <View className="mt-5 flex-row gap-2">
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

        <Modal
          visible={emailModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => {
            if (!accountBusy) setEmailModalOpen(false);
          }}
        >
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: accountModalBackdrop }}>
            <Pressable
              style={{ flex: 1 }}
              disabled={accountBusy}
              onPress={() => {
                if (accountBusy) return;
                setEmailModalOpen(false);
                setNewEmail("");
                setCurrentPwdForEmail("");
              }}
              accessibilityLabel={t("account.cancel")}
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ width: "100%" }}
            >
              <SafeAreaView edges={["bottom"]} style={accountSheetStyle}>
                <Text className="mb-3 text-xl font-semibold" style={{ color: tc.textPrimary }}>
                  {t("account.modalEmailTitle")}
                </Text>
                <Text className="text-sm" style={{ color: tc.textSecondary }}>
                  {t("account.modalEmailNew")}
                </Text>
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!accountBusy}
                  placeholderTextColor={tc.textSecondary}
                  className="mt-1 rounded-xl border px-3 py-3 text-base"
                  style={accountInputStyle}
                />
                <Text className="mt-3 text-sm" style={{ color: tc.textSecondary }}>
                  {t("account.modalEmailPassword")}
                </Text>
                <TextInput
                  value={currentPwdForEmail}
                  onChangeText={setCurrentPwdForEmail}
                  secureTextEntry
                  editable={!accountBusy}
                  placeholderTextColor={tc.textSecondary}
                  className="mt-1 rounded-xl border px-3 py-3 text-base"
                  style={accountInputStyle}
                />
                <View className="mt-5 flex-row gap-2">
                  <View className="min-h-[48px] flex-1">
                    <Button
                      title={t("account.cancel")}
                      variant="secondary"
                      disabled={accountBusy}
                      onPress={() => {
                        setEmailModalOpen(false);
                        setNewEmail("");
                        setCurrentPwdForEmail("");
                      }}
                    />
                  </View>
                  <View className="min-h-[48px] flex-1">
                    <Button
                      title={t("account.save")}
                      disabled={accountBusy}
                      onPress={() => void submitEmailChange()}
                    />
                  </View>
                </View>
              </SafeAreaView>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <PaywallGate
          visible={settingsPaywallOpen}
          onClose={() => {
            setSettingsPaywallOpen(false);
            void refreshSubscription();
          }}
        />
      </View>
    </View>
  );
}
