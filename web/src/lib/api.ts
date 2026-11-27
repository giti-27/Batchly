
const ENV_API_URL = import.meta.env.VITE_API_BASE_URL;
const IS_PRODUCTION = import.meta.env.PROD;

// Production uses the same Vercel domain for frontend and backend.
// Local development continues using localhost.
let activeApiBase = IS_PRODUCTION
  ? "/api"
  : (
      ENV_API_URL ||
      (typeof window !== "undefined" && window.location.port === "8001"
        ? "http://localhost:8001"
        : null) ||
      localStorage.getItem("batchly_active_api_base") ||
      "http://localhost:8001"
    );

export function getApiBase(): string {
  return activeApiBase;
}

export function setApiBase(url: string) {
  activeApiBase = url;

  if (!IS_PRODUCTION) {
    localStorage.setItem("batchly_active_api_base", url);
  }
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

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const candidateBases = IS_PRODUCTION
    ? ["/api"]
    : [
        activeApiBase,
        activeApiBase.includes("8001")
          ? "http://localhost:8000"
          : "http://localhost:8001",
        "http://127.0.0.1:8001",
        "http://127.0.0.1:8000",
      ];

  let lastError: any = null;

  for (const base of candidateBases) {
    try {
      const res = await fetch(`${base}${endpoint}`, {
        ...options,
        headers,
      });

      if (!IS_PRODUCTION && base !== activeApiBase) {
        setApiBase(base);
      }

      if (!res.ok) {
        const errorText = await res.text();
        let detail = `Error ${res.status}: ${res.statusText}`;

        try {
          const parsed = JSON.parse(errorText);
          const rawDetail = parsed?.detail ?? parsed?.message ?? parsed?.error;
          if (typeof rawDetail === "string") {
            detail = rawDetail;
          } else if (Array.isArray(rawDetail)) {
            // FastAPI/Pydantic validation errors are arrays of objects.
            // Convert them into readable messages instead of "[object Object]".
            detail = rawDetail.map((item: any) => {
              if (typeof item === "string") return item;
              const location = Array.isArray(item?.loc) ? item.loc.filter((part: unknown) => part !== "body").join(" → ") : "";
              const message = item?.msg || item?.message || JSON.stringify(item);
              return location ? `${location}: ${message}` : message;
            }).join("; ");
          } else if (rawDetail && typeof rawDetail === "object") {
            detail = rawDetail.message || rawDetail.msg || JSON.stringify(rawDetail);
          } else {
            detail = errorText || detail;
          }
        } catch {
          detail = errorText || detail;
        }

        throw new Error(String(detail));
      }

      return await res.json();
    } catch (err: any) {
      lastError = err;

      if (
        err instanceof TypeError &&
        err.message.toLowerCase().includes("fetch")
      ) {
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Failed to connect to Batchly backend.");
}
