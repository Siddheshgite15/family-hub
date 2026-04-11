/**
 * CORS allowlist: localhost dev defaults + FRONTEND_URL + optional CORS_ORIGINS (comma-separated).
 */
export function getCorsOriginList(): string[] {
  const defaults = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
  ];
  const fromEnv = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const front = process.env.FRONTEND_URL?.trim();
  return [...new Set([...defaults, ...fromEnv, ...(front ? [front] : [])])];
}
