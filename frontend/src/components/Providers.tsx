"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import FloatingChat from "@/components/FloatingChat";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ChatProvider>
        {children}
        <FloatingChat />
      </ChatProvider>
    </AuthProvider>
  );
}
