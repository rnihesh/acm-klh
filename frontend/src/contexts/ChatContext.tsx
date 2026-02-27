"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { sendChatMessage, getChatSuggestions } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatContextType {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  suggestions: string[];
  conversationId: string | undefined;
  sendMsg: (text: string) => Promise<void>;
  startNewChat: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    getChatSuggestions()
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {});
  }, []);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setInput("");
  }, []);

  const sendMsg = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await sendChatMessage(text.trim(), conversationId);
        setConversationId(res.conversation_id);
        const aiMsg: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch {
        const errMsg: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
      setLoading(false);
    },
    [loading, conversationId]
  );

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        setInput,
        loading,
        suggestions,
        conversationId,
        sendMsg,
        startNewChat,
        messagesEndRef,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
