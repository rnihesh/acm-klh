"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PageShell from "@/components/PageShell";
import { sendChatMessage, getChatSuggestions } from "@/lib/api";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getChatSuggestions()
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
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
          content:
            "Sorry, I encountered an error processing your request. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
      setLoading(false);
      inputRef.current?.focus();
    },
    [loading, conversationId]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <PageShell
      title="AI Assistant"
      description="Context-aware GST compliance assistant powered by your Knowledge Graph"
    >
      <div
        className="flex flex-col c-bg-card rounded-xl border c-border overflow-hidden"
        style={{ boxShadow: "var(--shadow-sm)", height: "calc(100vh - 180px)", minHeight: "500px" }}
      >
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "var(--accent-light)" }}
                >
                  <Sparkles className="w-6 h-6" style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold c-text">
                    GST Assistant
                  </h2>
                  <p className="text-sm c-text-3">
                    Ask me anything about your GST data
                  </p>
                </div>
              </div>

              {suggestions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl w-full">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left px-4 py-3 rounded-lg text-sm c-text-2 c-bg-dark hover:c-bg-card border c-border hover:c-border-accent transition-all"
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
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1"
                      style={{ backgroundColor: "var(--accent-light)" }}
                    >
                      <Bot className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "c-bg-accent text-white"
                        : "c-bg-dark"
                    }`}
                    style={
                      msg.role === "user"
                        ? { backgroundColor: "var(--accent)" }
                        : undefined
                    }
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                    <p
                      className={`text-[10px] mt-1.5 ${
                        msg.role === "user"
                          ? "text-white/60"
                          : "c-text-3"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 c-bg-dark"
                    >
                      <User className="w-4 h-4 c-text-2" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 justify-start">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "var(--accent-light)" }}
                  >
                    <Bot className="w-4 h-4" style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="c-bg-dark rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-current c-text-3 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 rounded-full bg-current c-text-3 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 rounded-full bg-current c-text-3 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-xs c-text-3">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div
          className="border-t p-3 md:p-4"
          style={{ borderColor: "var(--bg-border)" }}
        >
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your GST data, mismatches, vendor risks..."
              rows={1}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm outline-none resize-none max-h-32"
              style={{
                minHeight: "42px",
              }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] c-text-3 text-center mt-2">
            Powered by your GST Knowledge Graph &middot; Responses are AI-generated
          </p>
        </div>
      </div>
    </PageShell>
  );
}
