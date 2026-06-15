import "./globals.css";
import type { ReactNode } from "react";
import Navigation from "./components/Navigation";
import SessionWrapper from "./components/SessionWrapper";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

export const metadata = {
  title: "学生收费系统 - 优特补习学院",
  description: "收费与学籍管理系统",
  applicationName: "优特学院",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default" as const,
    title: "优特学院",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0ea5e9",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/favicon.svg" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="page-background text-gray-900 overflow-x-hidden">
        <SessionWrapper>
          <Navigation />
          <main className="relative z-10 pt-2 md:pt-4 pb-28 md:pb-4">
            {children}
          </main>
          <PWAInstallPrompt />
        </SessionWrapper>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
