import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeInitScript } from "@/components/theme-init";

export const metadata: Metadata = {
  title: "WebsiteAudit AI",
  description:
    "Technical website intelligence for developers, agencies, and modern businesses. Analyze performance, SEO, accessibility, security signals, UX, and technology stack.",
  openGraph: {
    title: "WebsiteAudit AI",
    description: "Find what is holding your website back.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WebsiteAudit AI",
    description: "Understand what is wrong with your website — and what to fix next.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} min-h-screen antialiased`}
        suppressHydrationWarning
      >
        <ThemeInitScript />
        {children}
      </body>
    </html>
  );
}
