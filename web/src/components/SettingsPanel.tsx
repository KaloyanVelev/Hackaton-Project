"use client";

import React, { useState } from "react";
import { Settings, X, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { DICTIONARY, Language } from "@/lib/i18n";

interface SettingsPanelProps {
  lang: Language;
  onSelectLang: (lang: Language) => void;
  llmBaseUrl: string;
  onChangeLlmBaseUrl: (url: string) => void;
  llmModel: string;
  onChangeLlmModel: (model: string) => void;
  maxPoints: number;
  onChangeMaxPoints: (points: number) => void;
}

export function SettingsPanel({
  lang,
  onSelectLang,
  llmBaseUrl,
  onChangeLlmBaseUrl,
  llmModel,
  onChangeLlmModel,
  maxPoints,
  onChangeMaxPoints,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [healthInfo, setHealthInfo] = useState<any>(null);
  const t = DICTIONARY[lang];

  const handleTestConnection = async () => {
    setTestStatus("testing");
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setHealthInfo(data);
      if (res.ok && data.db_connected) {
        setTestStatus(data.llm_reachable ? "ok" : "fail");
      } else {
        setTestStatus("fail");
      }
    } catch {
      setTestStatus("fail");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-30">
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 bg-dark-bg/92 hover:bg-dark-panel backdrop-blur-md border border-dark-border rounded-xl text-dark-text shadow-xl transition-all"
        title={t.settings}
      >
        <Settings className="w-4 h-4 text-dark-muted hover:text-dark-text transition-colors" />
      </button>

      {open && (
        <div className="absolute bottom-12 right-0 w-80 bg-dark-bg/95 backdrop-blur-md border border-dark-border rounded-xl shadow-2xl p-4 text-dark-text animate-in fade-in slide-in-from-bottom-2 space-y-3.5 text-xs">
          <div className="flex items-center justify-between border-b border-dark-border pb-2">
            <span className="font-semibold text-sm tracking-wide">{t.settings}</span>
            <button
              onClick={() => setOpen(false)}
              className="text-dark-muted hover:text-dark-text p-1 rounded-md hover:bg-dark-panel transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-dark-muted mb-1.5">{t.language}</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => onSelectLang("bg")}
                className={`py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  lang === "bg"
                    ? "bg-brand-amber/15 border-brand-amber text-brand-amber"
                    : "bg-dark-panel border-dark-border text-dark-muted hover:text-dark-text"
                }`}
              >
                Български (БГ)
              </button>
              <button
                onClick={() => onSelectLang("en")}
                className={`py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  lang === "en"
                    ? "bg-brand-amber/15 border-brand-amber text-brand-amber"
                    : "bg-dark-panel border-dark-border text-dark-muted hover:text-dark-text"
                }`}
              >
                English (EN)
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-dark-border/60">
            <label className="block text-[11px] font-medium text-dark-muted">{t.llmServer}</label>
            <div className="grid grid-cols-2 gap-1 mb-1.5">
              <button
                onClick={() => onChangeLlmBaseUrl("http://host.docker.internal:11434/v1")}
                className="py-1 px-1.5 text-[10px] bg-dark-panel hover:bg-dark-border border border-dark-border rounded text-dark-muted hover:text-dark-text text-center truncate"
              >
                Ollama :11434
              </button>
              <button
                onClick={() => onChangeLlmBaseUrl("http://host.docker.internal:1234/v1")}
                className="py-1 px-1.5 text-[10px] bg-dark-panel hover:bg-dark-border border border-dark-border rounded text-dark-muted hover:text-dark-text text-center truncate"
              >
                LM Studio :1234
              </button>
            </div>
            <input
              type="text"
              value={llmBaseUrl}
              onChange={(e) => onChangeLlmBaseUrl(e.target.value)}
              className="w-full bg-dark-panel border border-dark-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-dark-text focus:outline-none focus:border-brand-amber"
              placeholder="http://host.docker.internal:11434/v1"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-dark-muted mb-1">{t.llmModel}</label>
            <input
              type="text"
              value={llmModel}
              onChange={(e) => onChangeLlmModel(e.target.value)}
              className="w-full bg-dark-panel border border-dark-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-dark-text focus:outline-none focus:border-brand-amber"
              placeholder="qwen3.5:9b"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleTestConnection}
              disabled={testStatus === "testing"}
              className="flex-1 py-1.5 px-3 bg-dark-panel hover:bg-dark-border/80 border border-dark-border rounded-lg text-xs font-medium text-dark-text flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5 text-brand-amber" />
              <span>{testStatus === "testing" ? "..." : t.testConnection}</span>
            </button>
            {testStatus === "ok" && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t.connectionOk}
              </span>
            )}
            {testStatus === "fail" && (
              <span className="flex items-center gap-1 text-[11px] text-brand-fatal font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {t.connectionFailed}
              </span>
            )}
          </div>

          {healthInfo && (
            <div className="p-2 bg-dark-panel rounded-lg border border-dark-border/60 text-[10px] space-y-1 font-mono text-dark-muted">
              <div>DB Status: <span className="text-dark-text">{healthInfo.db_connected ? "Connected" : "Disconnected"}</span> ({healthInfo.crash_count} crashes)</div>
              <div>ML Engine: <span className="text-dark-text">{healthInfo.model_loaded ? "Loaded" : "Not Found"}</span></div>
              <div>LLM Host: <span className="text-dark-text">{healthInfo.llm_reachable ? "Reachable" : "Offline / Unreachable"}</span></div>
            </div>
          )}

          <div className="pt-2 border-t border-dark-border/60">
            <label className="block text-[11px] font-medium text-dark-muted mb-1.5">{t.maxPoints}</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[2000, 5000, 15000].map((p) => (
                <button
                  key={p}
                  onClick={() => onChangeMaxPoints(p)}
                  className={`py-1 rounded-lg border text-xs font-mono font-medium transition-colors ${
                    maxPoints === p
                      ? "bg-brand-amber/15 border-brand-amber text-brand-amber"
                      : "bg-dark-panel border-dark-border text-dark-muted hover:text-dark-text"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
