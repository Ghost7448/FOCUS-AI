"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export default function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const next = language === "en" ? "ar" : "en";
  return <button
    type="button"
    className="language-toggle"
    onClick={() => setLanguage(next)}
    aria-label={t("Language") + ": " + t(next === "ar" ? "Arabic" : "English")}
    title={t("Language")}
  >
    <Languages size={18}/>
    <span>{language === "en" ? "العربية" : "English"}</span>
  </button>;
}
