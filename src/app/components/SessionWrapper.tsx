"use client";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { ToastProvider } from "./ui/Toast";

interface SessionWrapperProps {
  children: ReactNode;
}

export default function SessionWrapper({ children }: SessionWrapperProps) {
  return (
    <SessionProvider>
      <ToastProvider>{children}</ToastProvider>
    </SessionProvider>
  );
}

