/**
 * Frontend configuration — centralizes the backend URL.
 * Uses Next.js public env var convention (NEXT_PUBLIC_*).
 */
const STORAGE_KEY = "soulbound_backend_url";
const envBackendUrl =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_URL) || "";

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const addCandidate = (list: string[], url?: string | null) => {
  if (!url) return;
  const normalized = normalizeBaseUrl(url.trim());
  if (!normalized) return;
  if (!list.includes(normalized)) list.push(normalized);
};

let activeBackendUrl = normalizeBaseUrl(envBackendUrl || "http://localhost:4000");

const setActiveBackendUrl = (url: string) => {
  activeBackendUrl = normalizeBaseUrl(url);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, activeBackendUrl);
  }
};

const getBackendCandidates = (): string[] => {
  const candidates: string[] = [];
  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const stored =
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;

  addCandidate(candidates, envBackendUrl);
  addCandidate(candidates, stored);
  addCandidate(candidates, activeBackendUrl);
  addCandidate(candidates, `http://${host}:4000`);
  addCandidate(candidates, `http://${host}:4001`);
  addCandidate(candidates, "http://localhost:4000");
  addCandidate(candidates, "http://localhost:4001");

  return candidates;
};

export const BACKEND_URL = activeBackendUrl;

export const getBackendUrl = (): string => {
  if (envBackendUrl) return normalizeBaseUrl(envBackendUrl);
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeBaseUrl(stored);
  }
  return activeBackendUrl;
};

export async function fetchBackend(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = getBackendCandidates();
  let lastError: unknown;

  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}${normalizedPath}`, init);
      setActiveBackendUrl(baseUrl);
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw (
    lastError ||
    new Error("Unable to reach backend server on configured local ports")
  );
}
