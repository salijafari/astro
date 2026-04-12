import { authApiRef } from "@/lib/authApiRef";
import type { DeepenResult, TarotHistoryItem, TarotReadingResult } from "@/types/tarot";
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

/** Progressive tarot — draw full Celtic spread (stored); client starts at single-card depth. */
export const drawTarotCard = async (
  getToken: () => Promise<string | null>,
  question?: string,
): Promise<{ reading: TarotReadingResult }> => {
  const res = await apiRequest("/api/tarot/draw", {
    method: "POST",
    getToken,
    body: JSON.stringify({ question }),
  });
  if (res.status === 403) {
    const err = await res.text();
    throw new Error(err.includes("daily") ? "daily_limit_reached" : err || "forbidden");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<{ reading: TarotReadingResult }>;
};

export const deepenTarotReading = async (
  getToken: () => Promise<string | null>,
  readingId: string,
): Promise<DeepenResult> => {
  const res = await apiRequest("/api/tarot/deepen", {
    method: "POST",
    getToken,
    body: JSON.stringify({ readingId }),
  });
  if (res.status === 403) {
    const err = await res.text();
    if (err.includes("premium")) throw new Error("premium_required");
    throw new Error(err || "forbidden");
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<DeepenResult>;
};

export const getTarotHistory = (
  getToken: () => Promise<string | null>,
  page = 1,
  limit = 10,
): Promise<{ readings: TarotHistoryItem[]; total: number; totalPages: number }> =>
  apiGetJson(`/api/tarot/history?page=${page}&limit=${limit}`, getToken);

export const getTarotReadingById = (
  getToken: () => Promise<string | null>,
  readingId: string,
): Promise<{ reading: TarotHistoryItem }> =>
  apiGetJson(`/api/tarot/reading/${encodeURIComponent(readingId)}`, getToken);
