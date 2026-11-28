const PRODUCTION_ORIGIN = "https://focus-ai-production-a7fd3f59.up.railway.app";

export function getAppOrigin(requestOrigin?: string) {
  const configured = (process.env.APP_URL || "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "0.0.0.0";
      if (!isLocal && (process.env.NODE_ENV !== "production" || url.protocol === "https:")) return url.origin;
    } catch {
      // Ignore malformed APP_URL and use the safe fallback below.
    }
  }

  if (process.env.NODE_ENV === "production") return PRODUCTION_ORIGIN;
  if (requestOrigin) {
    try { return new URL(requestOrigin).origin; } catch { /* use local default */ }
  }
  return "http://localhost:3000";
}
