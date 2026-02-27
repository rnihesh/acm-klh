"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Minimize2,
} from "lucide-react";
import { useChatContext } from "@/contexts/ChatContext";
import MarkdownRenderer from "@/components/MarkdownRenderer";

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const CORNER_POSITIONS: Record<Corner, { bottom?: string; top?: string; left?: string; right?: string }> = {
  "bottom-right": { bottom: "24px", right: "24px" },
  "bottom-left": { bottom: "24px", left: "24px" },
  "top-right": { top: "24px", right: "24px" },
  "top-left": { top: "24px", left: "24px" },
};

const MODAL_POSITIONS: Record<Corner, { bottom?: string; top?: string; left?: string; right?: string }> = {
  "bottom-right": { bottom: "80px", right: "24px" },
  "bottom-left": { bottom: "80px", left: "24px" },
  "top-right": { top: "80px", right: "24px" },
  "top-left": { top: "80px", left: "24px" },
};

export default function FloatingChat() {
  const pathname = usePathname();
  const { messages, input, setInput, loading, suggestions, conversationId, sendMsg } = useChatContext();

  const [isOpen, setIsOpen] = useState(false);
  const [corner, setCorner] = useState<Corner>("bottom-right");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Hide on these pages (checked AFTER all hooks)
  const hidden = pathname === "/login" || pathname === "/register" || pathname === "/chat";

  useEffect(() => {
    if (!hidden) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, hidden]);

  useEffect(() => {
    if (isOpen && !hidden) inputRef.current?.focus();
  }, [isOpen, hidden]);

  // Drag handling
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX, y: clientY });
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      setIsDragging(false);
      const clientX = "changedTouches" in e ? e.changedTouches[0].clientX : e.clientX;
      const clientY = "changedTouches" in e ? e.changedTouches[0].clientY : e.clientY;

      const dx = Math.abs(clientX - dragStart.x);
      const dy = Math.abs(clientY - dragStart.y);
      if (dx < 10 && dy < 10) {
        setIsOpen((prev) => !prev);
        return;
      }

      const midX = window.innerWidth / 2;
      const midY = window.innerHeight / 2;
      const isRight = clientX > midX;
      const isBottom = clientY > midY;

      if (isBottom && isRight) setCorner("bottom-right");
      else if (isBottom && !isRight) setCorner("bottom-left");
      else if (!isBottom && isRight) setCorner("top-right");
      else setCorner("top-left");
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, dragStart]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg(input);
    }
  };

  // Don't render on hidden pages
  if (hidden) return null;

  return (
    <>
      {/* Chat Modal */}
      {isOpen && (
        <div
          className="fixed z-50 flex flex-col c-bg-card rounded-2xl border c-border overflow-hidden"
          style={{
            ...MODAL_POSITIONS[corner],
            width: "min(420px, calc(100vw - 48px))",
            height: "min(560px, calc(100vh - 120px))",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          }}
        >
          {/* Modal Header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ borderColor: "var(--bg-border)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--accent-light)" }}
              >
                <Bot className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
              </div>
              <span className="text-sm font-medium c-text">GST Assistant</span>
              {conversationId && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
                  Active
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg c-text-3 hover:c-text hover:c-bg-dark transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="text-center">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{ backgroundColor: "var(--accent-light)" }}
                  >
                    <Sparkles className="w-6 h-6" style={{ color: "var(--accent)" }} />
                  </div>
                  <h3 className="text-base font-semibold c-text mb-1">GST Assistant</h3>
                  <p className="text-xs c-text-3 max-w-[280px]">
                    Ask about invoices, ITC claims, mismatches, or vendor risks.
                  </p>
                </div>
                {suggestions.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full px-1">
                    {suggestions.slice(0, 3).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => sendMsg(s)}
                        className="text-left px-3 py-2 rounded-lg text-xs c-text-2 c-bg-dark hover:c-bg-card border c-border hover:c-border-accent transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: "var(--accent-light)" }}
                      >
                        <Bot className="w-3 h-3" style={{ color: "var(--accent)" }} />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        msg.role === "user" ? "" : "c-bg-dark"
                      }`}
                      style={
                        msg.role === "user"
                          ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" }
                          : undefined
                      }
                    >
                      {msg.role === "assistant" ? (
                        <div className="text-xs">
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      ) : (
                        <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                      )}
                      <p className={`text-[9px] mt-1 ${msg.role === "user" ? "opacity-60" : "c-text-3"}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 c-bg-dark">
                        <User className="w-3 h-3 c-text-2" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "var(--accent-light)" }}
                    >
                      <Bot className="w-3 h-3" style={{ color: "var(--accent)" }} />
                    </div>
                    <div className="c-bg-dark rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-current c-text-3 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-current c-text-3 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-current c-text-3 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-[10px] c-text-3">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-2.5" style={{ borderColor: "var(--bg-border)" }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about GST data..."
                rows={1}
                className="flex-1 rounded-lg px-3 py-2 text-xs outline-none resize-none c-bg-dark c-text"
                style={{ minHeight: "36px", maxHeight: "100px" }}
                disabled={loading}
              />
              <button
                onClick={() => sendMsg(input)}
                disabled={!input.trim() || loading}
                className="flex items-center justify-center w-8 h-8 rounded-lg transition-all disabled:opacity-40"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className="fixed z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{
          ...CORNER_POSITIONS[corner],
          backgroundColor: "var(--accent)",
          color: "var(--accent-text)",
          boxShadow: "0 8px 32px rgba(99,102,241,0.4)",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        title="Chat with GST Assistant"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </>
  );
}
