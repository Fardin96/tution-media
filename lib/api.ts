const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export type UserRole = "STUDENT" | "TUTOR" | "ADMIN" | "SUPER_ADMIN";

export interface Account {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  picture?: string;
  status?: string;
}

let refreshPromise: Promise<Tokens | null> | null = null;

const STORAGE_KEY = "auth_tokens";

export function getStoredTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: Tokens | null): void {
  if (typeof window === "undefined") return;
  if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  else localStorage.removeItem(STORAGE_KEY);
}

async function rotateRefreshToken(
  refreshToken: string,
): Promise<Tokens | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Tokens;
    setStoredTokens(data);
    return data;
  } catch {
    return null;
  }
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const tokens = getStoredTokens();
  if (tokens?.accessToken) {
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }
  return headers;
}

async function doFetch(input: string, init: RequestInit): Promise<Response> {
  const url = input.startsWith("http") ? input : `${API_URL}${input}`;
  return fetch(url, { ...init, headers: buildHeaders(init) });
}

/**
 * Fetch wrapper for the external backend API.
 * Attaches the access token and automatically rotates it on 401 responses.
 * shortcut: tokens are stored in localStorage; move to httpOnly cookies if you add an API proxy.
 */
export async function apiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await doFetch(input, init);

  if (res.status === 401) {
    const tokens = getStoredTokens();
    if (tokens?.refreshToken) {
      if (!refreshPromise) {
        refreshPromise = rotateRefreshToken(tokens.refreshToken).finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;
      if (refreshed) {
        return doFetch(input, init);
      }
      setStoredTokens(null);
    }
  }

  return res;
}

async function request(method: string, input: string, body?: unknown) {
  return apiFetch(input, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const api = {
  get: (input: string) => request("GET", input),
  post: (input: string, body?: unknown) => request("POST", input, body),
  patch: (input: string, body?: unknown) => request("PATCH", input, body),
  put: (input: string, body?: unknown) => request("PUT", input, body),
  delete: (input: string) => request("DELETE", input),
  setTokens: setStoredTokens,
  getTokens: getStoredTokens,
  clearTokens: () => setStoredTokens(null),
};
