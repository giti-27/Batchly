// API base URL configuration with auto-port detection and fallback support
const ENV_API_URL = import.meta.env.VITE_API_BASE_URL;

// Determine primary API base URL
let activeApiBase = (
  ENV_API_URL ||
  (typeof window !== "undefined" && window.location.port === "8001" ? "http://localhost:8001" : null) ||
  localStorage.getItem("batchly_active_api_base") ||
  "http://localhost:8001" // Default to 8001 since 8001 is active, fallback to 8000
);

export function getApiBase(): string {
  return activeApiBase;
}

export function setApiBase(url: string) {
  activeApiBase = url;
  localStorage.setItem("batchly_active_api_base", url);
}

export const API_BASE = getApiBase();

export function getAuthToken(): string | null {
  return localStorage.getItem("batchly_token");
}

export function setAuthToken(token: string) {
  localStorage.setItem("batchly_token", token);
}

export function getCurrentUserRole(): string | null {
  return localStorage.getItem("batchly_role");
}

export function getCurrentUsername(): string | null {
  return localStorage.getItem("batchly_username");
}

export function setCurrentUser(username: string, role: string) {
  localStorage.setItem("batchly_username", username);
  localStorage.setItem("batchly_role", role);
}

export function clearAuth() {
  localStorage.removeItem("batchly_token");
  localStorage.removeItem("batchly_username");
  localStorage.removeItem("batchly_role");
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const candidateBases = [
    activeApiBase,
    activeApiBase.includes("8001") ? "http://localhost:8000" : "http://localhost:8001",
    "http://127.0.0.1:8001",
    "http://127.0.0.1:8000"
  ];

  let lastError: any = null;

  for (let i = 0; i < candidateBases.length; i++) {
    const base = candidateBases[i];
    try {
      const res = await fetch(`${base}${endpoint}`, {
        ...options,
        headers,
      });

      // If we got a response (even a 4xx from the actual FastAPI app), lock this base
      if (base !== activeApiBase) {
        setApiBase(base);
      }

      if (!res.ok) {
        const errorText = await res.text();
        let detail = `Error ${res.status}: ${res.statusText}`;
        try {
          const parsed = JSON.parse(errorText);
          detail = parsed.detail || parsed.message || detail;
        } catch {
          detail = errorText || detail;
        }
        throw new Error(detail);
      }

      return await res.json();
    } catch (err: any) {
      lastError = err;
      // If it was a network connection error (Failed to fetch), try the next candidate port
      if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
        continue;
      }
      // If it's an API error returned by FastAPI (e.g. 401 Unauthorized), don't retry alternative ports
      throw err;
    }
  }

  throw lastError || new Error("Failed to connect to Batchly backend on ports 8001 or 8000. Is FastAPI running?");
}
