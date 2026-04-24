import { LanguageSelector } from "@/components/LanguageSelector";
import { SmartAppBanner } from "@/components/SmartAppBanner";
import { getTokenWithRetry, useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ProfileStatusResponse = {
  complete?: boolean;
  missingFields?: string[];
};

/**
 * Root router: auth → token retry → profile completeness → home.
 * Trial is started by the backend on account creation; no subscription fetch here.
 */
export default function Index() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [, setSmartBannerInset] = useState(0);
  const { user, loading, getToken } = useAuth();
  const hasNavigated = useRef(false);
  const isRouting = useRef(false);
  const lastUid = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const uidNow = user?.uid ?? null;
    if (lastUid.current !== uidNow) {
      lastUid.current = uidNow;
      hasNavigated.current = false;
      isRouting.current = false;
    }

    if (hasNavigated.current || isRouting.current) return;

    const run = async () => {
      if (hasNavigated.current || isRouting.current) return;
      isRouting.current = true;

      try {
        if (!user) {
          hasNavigated.current = true;
          router.replace("/(auth)/welcome" as Href);
          return;
        }

        const idToken = await getTokenWithRetry(getToken);

        if (!idToken) {
          console.warn("[index] no idToken after retries — routing to sign-in");
          hasNavigated.current = true;
          router.replace("/(auth)/welcome" as Href);
          return;
        }

        let profileStatus: ProfileStatusResponse | null = null;
        try {
          const profileRes = await apiRequest("/api/user/profile/status", {
            getToken,
            method: "GET",
          });
          if (profileRes.ok) {
            profileStatus = (await profileRes.json()) as ProfileStatusResponse;
          } else {
            hasNavigated.current = true;
            router.replace("/(main)/home" as Href);
            return;
          }
        } catch {
          hasNavigated.current = true;
          router.replace("/(main)/home" as Href);
          return;
        }

        if (profileStatus && !profileStatus.complete) {
          const mf = profileStatus.missingFields ?? [];
          const needSetup =
            mf.includes("all") || mf.includes("name") || mf.includes("birthDate");
          if (needSetup) {
            hasNavigated.current = true;
            router.replace("/(profile-setup)/setup");
            return;
          }
        }

        hasNavigated.current = true;
        router.replace("/(main)/home" as Href);
      } catch (err) {
        console.error("[index] routing error:", err);
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          router.replace("/(auth)/welcome" as Href);
        }
      } finally {
        isRouting.current = false;
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: omit getToken/router to avoid re-route loops
  }, [loading, user]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/Android/i.test(ua) && /Mobile/i.test(ua)) {
      try {
        globalThis.localStorage?.removeItem("akhtar.smartBanner.closedAt");
      } catch {
        /* ignore */
      }
    }
  }, []);

  return (
    <View className="relative flex-1 items-center justify-center bg-slate-950">
      <SmartAppBanner onHeightChange={setSmartBannerInset} />
      <View
        className="absolute right-5 z-10"
        style={{ top: Math.max(insets.top, 8) + 12 }}
        pointerEvents="box-none"
      >
        <LanguageSelector variant="pills" />
      </View>
      <ActivityIndicator color="#8b8cff" size="large" />
    </View>
  );
}
