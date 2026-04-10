import { authApiRef } from "@/lib/authApiRef";
import type { TarotReadingResult, TarotSpreadData } from "@/types/tarot";
import { Platform } from "react-native";

const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export type ApiInit = RequestInit & {
  /** Firebase ID token for Railway API (Bearer). */
  getToken: () => Promise<string | null>;
};

/**
 * Central API client — all network calls go through here (Section 2 global rules).
 * On 401, forces a token refresh once; if still 401, runs onAuthFailure (sign out).
 */
export async function apiRequest(path: string, init: ApiInit): Promise<Response> {
  const { getToken, ...rest } = init;
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const buildHeaders = async (token: string | null) => {
    const headers = new Headers(rest.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.has("Content-Type") && rest.body) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  };

  try {
    let token = await getToken();
    let headers = await buildHeaders(token);
    let res = await fetch(url, { ...rest, headers, signal: controller.signal });

    if (res.status === 401 && authApiRef.refreshToken) {
      const t2 = await authApiRef.refreshToken();
      if (t2) {
        headers = await buildHeaders(t2);
        res = await fetch(url, { ...rest, headers, signal: controller.signal });
      }
    }

    if (res.status === 401 && authApiRef.onAuthFailure) {
      await authApiRef.onAuthFailure();
    }

    if (res.status === 402) {
      if (Platform.OS === "web") {
        const { router } = await import("expo-router");
        router.replace("/(subscription)/paywall");
      }
      throw new Error("subscription_required");
    }

    return res;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please check your connection.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * POST JSON helper.
 */
export async function apiPostJson<T>(
  path: string,
  getToken: () => Promise<string | null>,
  body: unknown,
): Promise<T> {
  const res = await apiRequest(path, {
    method: "POST",
    getToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<T>;
}

/**
 * GET JSON helper.
 */
export async function apiGetJson<T>(path: string, getToken: () => Promise<string | null>): Promise<T> {
  const res = await apiRequest(path, { method: "GET", getToken });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<T>;
}

/**
 * PUT JSON helper.
 */
export async function apiPutJson<T>(
  path: string,
  getToken: () => Promise<string | null>,
  body: unknown,
): Promise<T> {
  const res = await apiRequest(path, {
    method: "PUT",
    getToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<T>;
}

/**
 * DELETE helper — parses JSON body when present.
 */
export async function apiDeleteJson<T>(path: string, getToken: () => Promise<string | null>): Promise<T> {
  const res = await apiRequest(path, { method: "DELETE", getToken });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/** Tarot — uses {@link apiRequest} (central client). */
export const getTarotSpreads = (getToken: () => Promise<string | null>) =>
  apiGetJson<{ spreads: TarotSpreadData[] }>("/api/tarot/spreads", getToken);

export const getTarotReading = (getToken: () => Promise<string | null>, readingId: string) =>
  apiGetJson<{ reading: TarotReadingResult }>(
    `/api/tarot/reading/${encodeURIComponent(readingId)}`,
    getToken,
  );

export const getTarotHistory = (getToken: () => Promise<string | null>, page = 1, limit = 10) =>
  apiGetJson<{ readings: TarotReadingResult[]; total: number }>(
    `/api/tarot/history?page=${page}&limit=${limit}`,
    getToken,
  );

/**
 * Draw tarot cards; surfaces `daily_limit_reached` and `premium_required` in thrown message for UI.
 */
export const drawTarotCards = async (
  getToken: () => Promise<string | null>,
  spreadId: string,
  question?: string,
): Promise<{ reading: TarotReadingResult }> => {
  const res = await apiRequest("/api/tarot/draw", {
    method: "POST",
    getToken,
    body: JSON.stringify({ spreadId, question }),
  });
  if (res.status === 403) {
    const err = await res.text();
    throw new Error(err.includes("daily") ? "daily_limit_reached" : err || "forbidden");
  }
  if (res.status === 402) {
    throw new Error("premium_required");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<{ reading: TarotReadingResult }>;
};
