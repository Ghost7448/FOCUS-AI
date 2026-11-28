"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type ExtendedNavigator = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    platform?: string;
    mobile?: boolean;
    getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platformVersion?: string; architecture?: string }>;
  };
};

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || typeof navigator === "undefined") return;
    void (async () => {
      const ua = navigator.userAgent || "";
      const pick = (pattern: RegExp) => { const match = ua.match(pattern); return match ? match[1] + " " + (match[2] || "") : ""; };
      const browser = pick(/(EdgA?|EdgiOS)\/([\d.]+)/) || pick(/(OPR)\/([\d.]+)/) ||
        pick(/(Chrome)\/([\d.]+)/) || pick(/(Firefox)\/([\d.]+)/) ||
        pick(/(Version)\/([\d.]+).*Safari/) || pick(/(Safari)\/([\d.]+)/) || "Unknown";
      const operatingSystem = pick(/(Android)[ \/]?([\d.]*)/i) || pick(/(iPhone OS|iOS) ([\d_]+)/i) ||
        pick(/(Windows NT) ([\d.]+)/i) || pick(/(Mac OS X) ([\d_]+)/i) ||
        pick(/(CrOS) ([\d.]+)/i) || navigator.platform || "Unknown";
      const deviceType = /tablet|ipad/i.test(ua) ? "Tablet" : /mobile|iphone|ipod|android/i.test(ua) ? "Mobile" : "Desktop";
      const nav = navigator as ExtendedNavigator;
      let deviceInfo = nav.userAgentData?.platform || deviceType;
      try {
        if (nav.userAgentData?.getHighEntropyValues) {
          const high = await nav.userAgentData.getHighEntropyValues(["model","platformVersion","architecture"]);
          deviceInfo = [high.model,high.platformVersion,high.architecture].filter(Boolean).join(" · ") || deviceInfo;
        }
      } catch {}
      let safeReferrer = "";
      try { if (document.referrer) { const ref = new URL(document.referrer); safeReferrer = ref.origin + ref.pathname; } } catch {}
      const payload = {
        path: pathname, browser, operatingSystem, deviceType, deviceInfo,
        screenResolution: screen ? `${screen.width} × ${screen.height} (${window.devicePixelRatio || 1}x)` : "",
        language: navigator.languages?.join(", ") || navigator.language || "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        referrer: safeReferrer, cookiesEnabled: !!navigator.cookieEnabled,
        platform: nav.userAgentData?.platform || navigator.platform || "",
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: nav.deviceMemory || 0, touchPoints: navigator.maxTouchPoints || 0
      };
      fetch("/api/visitors/track", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), keepalive: true
      }).catch(() => {});
    })();
  }, [pathname]);

  return null;
}
