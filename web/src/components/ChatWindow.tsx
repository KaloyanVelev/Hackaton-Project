"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Sparkles, Database, Loader2, CheckCircle2 } from "lucide-react";
import { DICTIONARY, Language } from "@/lib/i18n";
import { ChatResponse } from "@/lib/schemas";

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  selectedMuni: string;
  llmBaseUrl: string;
  llmModel: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  llmAvailable?: boolean;
}

export function ChatWindow({
  isOpen,
  onClose,
  lang,
  selectedMuni,
  llmBaseUrl,
  llmModel,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: lang === "bg"
        ? "Здравейте! Аз съм StreetAware AI анализатор. Мога да ви дам реална статистика за катастрофи, опасни часове и прогнозен риск от базата данни."
        : "Hello! I am the StreetAware AI Analyst. I can provide verified crash statistics, peak risk hours, and calibrated fatal risk predictions.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const t = DICTIONARY[lang];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const message = (textToSend || input).trim();
    if (!message || loading) return;

    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: message }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const historyPayload = newMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          municipality: selectedMuni || undefined,
          history: historyPayload,
          llm_base_url: llmBaseUrl || undefined,
          llm_model: llmModel || undefined,
        }),
      });

      if (res.ok) {
        const json: ChatResponse = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: json.answer,
            toolsUsed: json.tool_calls_used,
            llmAvailable: json.llm_available,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Възникна грешка при свързване с анализатора.",
            llmAvailable: false,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Възникна мрежова грешка при обработка на заявката.",
          llmAvailable: false,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 w-96 h-[500px] bg-dark-bg/95 backdrop-blur-xl border border-dark-border rounded-2xl shadow-2xl flex flex-col text-dark-text animate-in slide-in-from-bottom-4 duration-200">
      <div className="p-3 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-sky-500/10 border border-sky-500/20">
            <Bot className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="font-semibold text-xs text-dark-text">{t.aiTitle}</div>
            <div className="text-[10px] text-dark-muted font-mono">{llmModel}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-dark-muted hover:text-dark-text p-1 rounded-lg hover:bg-dark-panel transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`p-2.5 rounded-xl max-w-[85%] leading-relaxed ${
                m.role === "user"
                  ? "bg-brand-amber text-dark-bg font-medium"
                  : "bg-dark-panel border border-dark-border text-dark-text"
              }`}
            >
              {m.content}
            </div>

            {m.toolsUsed && m.toolsUsed.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 max-w-[85%]">
                {m.toolsUsed.map((tool, ti) => (
                  <span
                    key={ti}
                    className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-dark-panel/80 text-dark-muted border border-dark-border"
                  >
                    <Database className="w-2.5 h-2.5 text-brand-amber" />
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 p-2 bg-dark-panel/40 rounded-xl border border-dark-border/40 text-dark-muted text-[11px] w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-amber" />
            <span>Анализ на реални данни...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="px-3 pt-1 pb-2 border-t border-dark-border/60">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {[t.quickPrompt1, t.quickPrompt2, t.quickPrompt3].map((qp, i) => (
            <button
              key={i}
              onClick={() => handleSend(qp)}
              className="text-[10px] text-dark-muted hover:text-dark-text bg-dark-panel hover:bg-dark-border/80 border border-dark-border rounded-full px-2.5 py-1 whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-2.5 h-2.5 text-brand-amber" />
              <span>{qp}</span>
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.aiPlaceholder}
            className="flex-1 bg-dark-panel border border-dark-border rounded-xl px-3 py-2 text-xs text-dark-text placeholder:text-dark-muted/60 focus:outline-none focus:border-brand-amber"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 bg-brand-amber hover:bg-brand-amber/90 text-dark-bg rounded-xl transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
