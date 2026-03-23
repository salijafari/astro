const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export type ApiInit = RequestInit & {
  /** Session token from auth provider (or null in preview mode). */
  getToken: () => Promise<string | null>;
};

/**
 * Central API client — all network calls go through here (Section 2 global rules).
 */
export async function apiRequest(path: string, init: ApiInit): Promise<Response> {
  const { getToken, ...rest } = init;
  const token = await getToken();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(rest.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...rest, headers });
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
