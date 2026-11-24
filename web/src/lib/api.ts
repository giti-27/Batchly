const API_BASE = "http://localhost:8000";

export function getAuthToken(): string | null {
  return localStorage.getItem("batchly_token");
}

export function setAuthToken(token: string) {
  localStorage.setItem("batchly_token", token);
}

export function getCurrentUserRole(): string | null {
  return localStorage.getItem("batchly_role");
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

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let detail = `Error ${res.status}: ${res.statusText}`;
    try {
      const parsed = JSON.parse(errorText);
      detail = parsed.detail || detail;
    } catch {
      detail = errorText || detail;
    }
    throw new Error(detail);
  }

  return res.json();
}
