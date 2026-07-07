const TOKEN_KEY = "vk_flask_token";
const USER_KEY = "vk_flask_user";
const AUTH_EVENT = "vk_flask_auth_changed";

export type FlaskUser = {
  id: string;
  email: string;
  full_name?: string | null;
  phone?: string | null;
  language?: string | null;
  created_at?: string;
  updated_at?: string;
};

type AuthResponse = {
  token: string;
  user: FlaskUser;
};

function apiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return configured?.replace(/\/$/, "") || "";
}

async function authRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  }
  return data as T;
}

function emitAuthChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_EVENT));
}

export function getFlaskToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredFlaskUser(): FlaskUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as FlaskUser) : null;
  } catch {
    return null;
  }
}

function storeSession(data: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  emitAuthChanged();
}

export async function flaskLogin(email: string, password: string) {
  const data = await authRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  storeSession(data);
  return data.user;
}

export async function flaskRegister(email: string, password: string, fullName: string) {
  const data = await authRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  storeSession(data);
  return data.user;
}

export async function getCurrentFlaskUser() {
  const token = getFlaskToken();
  if (!token) return null;
  try {
    const data = await authRequest<{ user: FlaskUser }>("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data.user;
  } catch {
    flaskLogout();
    return null;
  }
}

export function flaskLogout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuthChanged();
}

export function onFlaskAuthChange(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AUTH_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(AUTH_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
