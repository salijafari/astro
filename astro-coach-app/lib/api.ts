import { authApiRef } from "@/lib/authApiRef";

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
  // #region agent log
  if (path.includes("/api/chat/complete") || path.includes("/api/chat/message")) {
    fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'endpoint-audit-2',hypothesisId:'F-endpoint-mismatch',location:'astro-coach-app/lib/api.ts:apiRequest:start',message:'api request start',data:{path,url,hasBase:!!base},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion

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

  let token = await getToken();
  // #region agent log
  if (path.includes("/api/chat/message")) {
    fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'auth-audit-1',hypothesisId:'J-token-missing',location:'astro-coach-app/lib/api.ts:apiRequest:token',message:'primary token resolved',data:{path,hasToken:!!token,tokenLength:token?.length ?? 0},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
  let headers = await buildHeaders(token);
  let res = await fetch(url, { ...rest, headers });

  if (res.status === 401 && authApiRef.refreshToken) {
    // #region agent log
    if (path.includes("/api/chat/message")) {
      fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'auth-audit-1',hypothesisId:'K-refresh-failed',location:'astro-coach-app/lib/api.ts:apiRequest:refresh-start',message:'401 received, attempting token refresh',data:{path,status:res.status},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    const t2 = await authApiRef.refreshToken();
    if (t2) {
      headers = await buildHeaders(t2);
      res = await fetch(url, { ...rest, headers });
    }
    // #region agent log
    if (path.includes("/api/chat/message")) {
      fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'auth-audit-1',hypothesisId:'K-refresh-failed',location:'astro-coach-app/lib/api.ts:apiRequest:refresh-end',message:'refresh attempt finished',data:{path,hasRefreshedToken:!!t2,refreshedTokenLength:t2?.length ?? 0,statusAfterRefresh:res.status},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
  }

  if (res.status === 401 && authApiRef.onAuthFailure) {
    // #region agent log
    if (path.includes("/api/chat/message")) {
      fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'auth-audit-1',hypothesisId:'L-auth-signout-sideeffect',location:'astro-coach-app/lib/api.ts:apiRequest:onAuthFailure',message:'still 401 after refresh; triggering onAuthFailure',data:{path},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    await authApiRef.onAuthFailure();
  }
  // #region agent log
  if (path.includes("/api/chat/complete") || path.includes("/api/chat/message")) {
    fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'endpoint-audit-2',hypothesisId:'G-chat-complete-crash',location:'astro-coach-app/lib/api.ts:apiRequest:end',message:'api request end',data:{path,status:res.status,url},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion

  return res;
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
    // #region agent log
    if (path.includes("/api/chat/complete") || path.includes("/api/chat/message")) {
      fetch('http://127.0.0.1:7684/ingest/ba32e604-56fa-4931-9450-eaf74e2f477b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b325c3'},body:JSON.stringify({sessionId:'b325c3',runId:'endpoint-audit-2',hypothesisId:'G-chat-complete-crash',location:'astro-coach-app/lib/api.ts:apiPostJson:non-ok',message:'non-ok apiPostJson response',data:{path,status:res.status,bodyPreview:(err ?? '').slice(0,240)},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
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
