import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { type Href, Redirect, Slot, useRouter, useSegments } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

const BG = "#0f172a";
const SIDEBAR = "#0a0f1e";
const BORDER = "#1e293b";
const ACCENT = "#7c3aed";
const MUTED = "#94a3b8";

const NAV_ITEMS: { label: string; icon: keyof typeof Ionicons.glyphMap; path: Href }[] = [
  { label: "Overview", icon: "grid-outline", path: "/(admin)" },
  { label: "Users", icon: "people-outline", path: "/(admin)/users" },
  { label: "Admins", icon: "shield-outline", path: "/(admin)/admins" },
  { label: "Notifications", icon: "notifications-outline", path: "/(admin)/notifications" },
  { label: "Audit Log", icon: "list-outline", path: "/(admin)/audit" },
];

/**
 * Web-only admin shell: Firebase session + /api/admin/check, then sidebar (desktop) or top icon bar (mobile web).
 */
export default function AdminLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  if (Platform.OS !== "web") {
    return <Redirect href="/(main)/home" />;
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/(auth)/sign-in" as Href);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequest("/api/admin/check", { method: "GET", getToken });
        if (cancelled) return;
        if (res.ok) {
          setStatus("allowed");
        } else {
          setStatus("denied");
          router.replace("/(main)/home" as Href);
        }
      } catch {
        if (cancelled) return;
        setStatus("denied");
        router.replace("/(main)/home" as Href);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, router]);

  const isNavActive = (path: Href) => {
    const key = typeof path === "string" ? path : String(path);
    const segs = segments as string[];
    const adminSeg = segs[0];
    const rest = segs[1];
    if (key === "/(admin)" || key.endsWith("/(admin)")) {
      return adminSeg === "(admin)" && (rest === undefined || rest === "index");
    }
    if (key.includes("/users")) return rest === "users";
    if (key.includes("/admins")) return rest === "admins";
    if (key.includes("/notifications")) return rest === "notifications";
    if (key.includes("/audit")) return rest === "audit";
    return false;
  };

  if (!isLoaded || (isSignedIn && status === "checking")) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!isSignedIn || status === "denied") {
    return null;
  }

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: BG }}>
        <View
          style={{
            width: 220,
            backgroundColor: SIDEBAR,
            borderRightWidth: 1,
            borderRightColor: BORDER,
            paddingTop: 24,
          }}
        >
          <Text
            style={{
              color: ACCENT,
              fontSize: 18,
              fontWeight: "700",
              paddingHorizontal: 20,
              marginBottom: 32,
            }}
          >
            Akhtar Admin
          </Text>
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item.path);
            return (
              <Pressable
                key={String(item.path)}
                onPress={() => router.push(item.path)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  backgroundColor: active ? "#1e1040" : "transparent",
                  borderRightWidth: active ? 3 : 0,
                  borderRightColor: ACCENT,
                }}
              >
                <Ionicons name={item.icon} size={18} color={active ? ACCENT : MUTED} />
                <Text style={{ color: active ? "#ffffff" : MUTED, fontSize: 14 }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flex: 1, minHeight: 0, overflow: "scroll" as const }}>
          <Slot />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: SIDEBAR,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item.path);
          return (
            <Pressable
              key={String(item.path)}
              onPress={() => router.push(item.path)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 10,
                borderBottomWidth: active ? 2 : 0,
                borderBottomColor: ACCENT,
              }}
            >
              <Ionicons name={item.icon} size={16} color={active ? ACCENT : MUTED} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1, minHeight: 0 }}>
        <Slot />
      </View>
    </View>
  );
}
