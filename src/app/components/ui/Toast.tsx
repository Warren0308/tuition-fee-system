"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // 服务端渲染或未注册时降级为 alert
    return {
      show: (msg: string) => typeof window !== "undefined" && alert(msg),
      success: (msg: string) => typeof window !== "undefined" && alert("✓ " + msg),
      error: (msg: string) => typeof window !== "undefined" && alert("✗ " + msg),
      info: (msg: string) => typeof window !== "undefined" && alert(msg),
      warning: (msg: string) => typeof window !== "undefined" && alert("⚠ " + msg),
    } as ToastContextValue;
  }
  return ctx;
}

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "bg-emerald-50", border: "border-emerald-300", icon: "✓" },
  error: { bg: "bg-red-50", border: "border-red-300", icon: "✗" },
  info: { bg: "bg-blue-50", border: "border-blue-300", icon: "ℹ" },
  warning: { bg: "bg-amber-50", border: "border-amber-300", icon: "⚠" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "info", duration = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
    },
    [remove]
  );

  const value: ToastContextValue = {
    show,
    success: (m, d) => show(m, "success", d),
    error: (m, d) => show(m, "error", d ?? 5000),
    info: (m, d) => show(m, "info", d),
    warning: (m, d) => show(m, "warning", d ?? 4500),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-md">
        {toasts.map((t) => {
          const styles = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`${styles.bg} ${styles.border} border rounded-lg shadow-lg p-3 pr-2 flex items-start gap-2 pointer-events-auto animate-fade-in-right`}
            >
              <span className="text-lg leading-none mt-0.5">{styles.icon}</span>
              <div className="flex-1 text-sm text-gray-800 break-words">{t.message}</div>
              <button
                onClick={() => remove(t.id)}
                className="text-gray-400 hover:text-gray-700 flex-shrink-0 leading-none"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** 异步操作辅助 hook：自动 toast 错误并管理 loading 状态 */
export function useAsyncAction() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function run<T>(
    fn: () => Promise<T>,
    options?: {
      successMessage?: string;
      errorPrefix?: string;
      onSuccess?: (result: T) => void;
    }
  ): Promise<T | undefined> {
    setLoading(true);
    try {
      const result = await fn();
      if (options?.successMessage) toast.success(options.successMessage);
      options?.onSuccess?.(result);
      return result;
    } catch (e: any) {
      const msg = e?.message || "操作失败";
      toast.error(`${options?.errorPrefix || ""}${msg}`);
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  return { loading, run };
}
