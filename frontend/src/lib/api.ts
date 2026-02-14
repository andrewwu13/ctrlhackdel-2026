const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Generic fetch wrapper for REST API calls to the backend.
 */
async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── API Methods ────────────────────────────────────────────────────

export const api = {
  /** Health check */
  health: () => request<{ status: string; timestamp: string }>("/api/health"),

  /** Start onboarding session → returns sessionId */
  startOnboarding: () =>
    request<{ sessionId: string; socketNamespace: string }>("/api/onboarding/start", {
      method: "POST",
    }),

  /** Start a match session between two users */
  startMatch: (userAId: string, userBId: string) =>
    request<{ sessionId: string; socketNamespace: string }>("/api/match/start", {
      method: "POST",
      body: JSON.stringify({ userAId, userBId }),
    }),

  /** Get match results */
  getMatchResult: (sessionId: string) =>
    request<import("./types").CompatibilityResult>(`/api/match/${sessionId}`),
};
