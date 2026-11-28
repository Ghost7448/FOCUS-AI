import type { Metadata } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import LanguageProvider from "@/components/LanguageProvider";
import VisitorTracker from "@/components/VisitorTracker";
import CustomCursor from "@/components/CustomCursor";

export const metadata: Metadata = {
  title: "FOCUS AI | Your Personal AI Learning Companion",
  description: "One Platform. A smarter, calmer way to learn.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/favicon.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <VisitorTracker/>
            <CustomCursor/>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
