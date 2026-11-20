"use client";

import React, { useEffect, useState } from "react";
import { X, AlertTriangle, MapPin, Calendar, Clock, ShieldAlert, ExternalLink } from "lucide-react";
import { DICTIONARY, Language } from "@/lib/i18n";
import { CrashDetail } from "@/lib/schemas";

interface CrashDetailCardProps {
  crashId: number | null;
  onClose: () => void;
  lang: Language;
}

export function CrashDetailCard({ crashId, onClose, lang }: CrashDetailCardProps) {
  const [data, setData] = useState<CrashDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const t = DICTIONARY[lang];

  useEffect(() => {
    if (!crashId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/crashes/${crashId}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [crashId]);

  if (!crashId) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-96 bg-dark-bg/95 backdrop-blur-md border border-dark-border rounded-xl shadow-2xl p-4 text-dark-text animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between border-b border-dark-border pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-brand-amber" />
          <h3 className="font-semibold text-sm tracking-wide">{t.crashDetails} #{crashId}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-dark-muted hover:text-dark-text p-1 rounded-lg hover:bg-dark-panel transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-dark-muted animate-pulse">Зареждане...</div>
      ) : data ? (
        <div className="space-y-2.5 text-xs">
          <div className="flex items-start gap-2 text-dark-muted">
            <MapPin className="w-4 h-4 text-brand-amber shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-dark-text">{data.municipality}</span>
              {data.settlement && <span>, {data.settlement}</span>}
              <span className="block text-[11px] text-dark-muted/80">
                {data.lat.toFixed(5)}, {data.lon.toFixed(5)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-dark-muted">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(data.occurred_at).toLocaleDateString(lang === "bg" ? "bg-BG" : "en-US")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{String(data.hour).padStart(2, "0")}:00</span>
            </div>
          </div>

          <div className="p-2.5 bg-dark-panel rounded-lg border border-dark-border/60">
            <div className="text-[11px] text-dark-muted uppercase tracking-wider">{t.crashType}</div>
            <div className="font-medium text-dark-text text-xs mt-0.5">{data.crash_type}</div>
            {data.road_class && (
              <div className="text-[11px] text-dark-muted mt-1">
                {t.roadClass}: <span className="text-dark-text">{data.road_class}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2 rounded-lg border ${data.killed > 0 ? "bg-brand-fatal/15 border-brand-fatal/30 text-brand-fatal" : "bg-dark-panel border-dark-border"}`}>
              <div className="text-[10px] uppercase font-semibold">{t.killed}</div>
              <div className="text-lg font-bold mt-0.5">{data.killed}</div>
            </div>
            <div className={`p-2 rounded-lg border ${data.injured > 0 ? "bg-brand-amber/15 border-brand-amber/30 text-brand-amber" : "bg-dark-panel border-dark-border"}`}>
              <div className="text-[10px] uppercase font-semibold">{t.injured}</div>
              <div className="text-lg font-bold mt-0.5">{data.injured}</div>
            </div>
          </div>

          <div className="text-[11px] text-dark-muted pt-1 flex items-center justify-between border-t border-dark-border/40">
            <span>{t.nearby500m}:</span>
            <span className="font-semibold text-dark-text bg-dark-panel px-2 py-0.5 rounded border border-dark-border">
              {data.nearby_500m_count}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-dark-border/40">
            <a
              href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${data.lat},${data.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1.5 px-2 bg-dark-panel hover:bg-dark-border/80 border border-dark-border rounded-lg text-center text-[11px] font-medium text-dark-text hover:text-brand-amber transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Street View</span>
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1.5 px-2 bg-dark-panel hover:bg-dark-border/80 border border-dark-border rounded-lg text-center text-[11px] font-medium text-dark-text hover:text-brand-amber transition-colors flex items-center justify-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Google Maps</span>
            </a>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-dark-muted">Няма данни.</div>
      )}
    </div>
  );
}
