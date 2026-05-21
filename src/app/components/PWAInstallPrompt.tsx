"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 检测 iOS Safari
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(ios);

    // 检测是否已经安装
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    // 检查最近是否已经关闭
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) {
        return;
      }
    } catch {}

    // 监听 beforeinstallprompt（Chrome / Edge）
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari 没有 beforeinstallprompt，3 秒后显示自定义提示
    if (ios) {
      const t = setTimeout(() => setShow(true), 3000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setInstallEvent(null);
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  };

  if (isStandalone || !show) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-2 right-2 md:left-auto md:right-4 md:w-80 z-40 animate-fade-in-right">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0">
            📱
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-800 text-sm mb-1">
              添加到主屏幕
            </div>
            <div className="text-xs text-gray-600 leading-relaxed">
              {isIos ? (
                <>
                  点击 Safari 底部分享按钮 <span className="inline-block px-1 py-0.5 bg-gray-100 rounded">⬆</span>，
                  然后选择"添加到主屏幕"
                </>
              ) : (
                <>像 App 一样使用本系统，更快、可全屏</>
              )}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-700 flex-shrink-0"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {!isIos && installEvent && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium text-sm hover:shadow-md transition-shadow"
          >
            立即安装
          </button>
        )}
      </div>
    </div>
  );
}
