/**
 * Frontend configuration — centralizes the backend URL.
 * Uses Next.js public env var convention (NEXT_PUBLIC_*).
 */
export const BACKEND_URL =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_BACKEND_URL) ||
  "http://localhost:4000";
