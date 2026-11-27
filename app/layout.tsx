import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOCUS AI | Your Personal AI Learning Companion",
  description: "One Platform. A Smarter Way to Learn."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}