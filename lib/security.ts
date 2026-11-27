import { NextRequest } from "next/server";

export function hasSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const requestHost = (request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host).split(",")[0].trim().toLowerCase();
    return originHost === requestHost;
  } catch {
    return false;
  }
}
