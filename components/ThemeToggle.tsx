"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useLanguage } from "@/components/LanguageProvider";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={t(isDark ? "Switch to light mode" : "Switch to dark mode")}
      title={t(isDark ? "Light mode" : "Dark mode")}
    >
      {isDark ? <Sun size={19} /> : <Moon size={19} />}
      <span className="hidden sm:inline">{isDark ? t("Light") : t("Dark")}</span>
    </button>
  );
}
