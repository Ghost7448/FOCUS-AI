import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import LanguageProvider from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "FOCUS AI | Your Personal AI Learning Companion",
  description: "One Platform. A smarter, calmer way to learn."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
