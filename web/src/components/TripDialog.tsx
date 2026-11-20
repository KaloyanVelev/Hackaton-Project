"use client";

import React, { useState } from "react";
import { X, Navigation, AlertTriangle, ShieldCheck, Route, Loader2 } from "lucide-react";
import { DICTIONARY, Language } from "@/lib/i18n";
import { TripRiskResponse } from "@/lib/schemas";

interface TripDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onApplyRoute: (routeGeoJson: any) => void;
}

const PRESET_CITIES = [
  { name: "София", lat: 42.6977, lon: 23.3219 },
  { name: "Пловдив", lat: 42.1354, lon: 24.7453 },
  { name: "Варна", lat: 43.2141, lon: 27.9147 },
  { name: "Бургас", lat: 42.5048, lon: 27.4626 },
  { name: "Велико Търново", lat: 43.0757, lon: 25.6172 },
  { name: "Габрово", lat: 42.8742, lon: 25.3187 },
  { name: "Русе", lat: 43.8356, lon: 25.9657 },
  { name: "Стара Загора", lat: 42.4258, lon: 25.6345 },
  { name: "Плевен", lat: 43.4170, lon: 24.6167 },
  { name: "Благоевград", lat: 42.0209, lon: 23.0943 },
];

export function TripDialog({ isOpen, onClose, lang, onApplyRoute }: TripDialogProps) {
  const [originIndex, setOriginIndex] = useState(0);
  const [destIndex, setDestIndex] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(4);
  const [departureHour, setDepartureHour] = useState(18);
  const [bufferMeters, setBufferMeters] = useState(1500);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TripRiskResponse | null>(null);

  const t = DICTIONARY[lang];

  if (!isOpen) return null;

  const handleCalculate = async () => {
    setLoading(true);
    const origin = PRESET_CITIES[originIndex];
    const dest = PRESET_CITIES[destIndex];

    try {
      const res = await fetch("/api/trip-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin_name: origin.name,
          dest_name: dest.name,
          origin_lat: origin.lat,
          origin_lon: origin.lon,
          dest_lat: dest.lat,
          dest_lon: dest.lon,
          day_of_week: dayOfWeek,
          departure_hour: departureHour,
          buffer_meters: bufferMeters,
        }),
      });

      if (res.ok) {
        const json: TripRiskResponse = await res.json();
        setResult(json);
        onApplyRoute(json.route_geojson);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-dark-bg border border-dark-border rounded-2xl shadow-2xl p-5 text-dark-text space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-dark-border pb-3">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">{t.tripTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-dark-text p-1.5 rounded-lg hover:bg-dark-panel transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-dark-muted mb-1">{t.originCity}</label>
            <select
              value={originIndex}
              onChange={(e) => setOriginIndex(Number(e.target.value))}
              className="w-full bg-dark-panel border border-dark-border rounded-lg px-2.5 py-2 text-xs text-dark-text focus:outline-none focus:border-brand-amber font-semibold"
            >
              {PRESET_CITIES.map((c, i) => (
                <option key={c.name} value={i}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-dark-muted mb-1">{t.destCity}</label>
            <select
              value={destIndex}
              onChange={(e) => setDestIndex(Number(e.target.value))}
              className="w-full bg-dark-panel border border-dark-border rounded-lg px-2.5 py-2 text-xs text-dark-text focus:outline-none focus:border-brand-amber font-semibold"
            >
              {PRESET_CITIES.map((c, i) => (
                <option key={c.name} value={i}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-dark-muted mb-1">{t.dayOfWeek}</label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full bg-dark-panel border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-dark-text focus:outline-none focus:border-brand-amber"
            >
              {["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"].map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-dark-muted mb-1">{t.departureHour} ({departureHour}:00)</label>
            <input
              type="range"
              min="0"
              max="23"
              value={departureHour}
              onChange={(e) => setDepartureHour(Number(e.target.value))}
              className="w-full accent-emerald-400 mt-2"
            />
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={loading}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-dark-bg font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          <span>{t.btnCalculateTrip}</span>
        </button>

        {result && (
          <div className="p-3.5 bg-dark-panel rounded-xl border border-dark-border space-y-3 animate-in fade-in">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-dark-bg rounded-lg border border-dark-border/60">
                <div className="text-[10px] text-dark-muted uppercase font-semibold">{t.distance}</div>
                <div className="text-base font-bold text-dark-text mt-0.5">{result.distance_km} км</div>
              </div>
              <div className="p-2 bg-dark-bg rounded-lg border border-dark-border/60">
                <div className="text-[10px] text-dark-muted uppercase font-semibold">Инциденти</div>
                <div className="text-base font-bold text-dark-text mt-0.5">{result.total_corridor_crashes}</div>
              </div>
              <div className="p-2 bg-dark-bg rounded-lg border border-dark-border/60">
                <div className="text-[10px] text-brand-fatal uppercase font-semibold">Фатални</div>
                <div className="text-base font-bold text-brand-fatal mt-0.5">{result.fatal_crashes}</div>
              </div>
              <div className="p-2 bg-dark-bg rounded-lg border border-dark-border/60 flex flex-col justify-center items-center">
                <div className="text-[10px] text-dark-muted uppercase font-semibold">Риск</div>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black uppercase mt-0.5 ${
                  result.risk_tier === "CRITICAL"
                    ? "bg-brand-fatal/20 text-brand-fatal border border-brand-fatal"
                    : result.risk_tier === "HIGH"
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500"
                    : result.risk_tier === "MODERATE"
                    ? "bg-brand-amber/20 text-brand-amber border border-brand-amber"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500"
                }`}>
                  {result.risk_tier}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase font-semibold text-brand-amber">{t.driverWarning}:</div>
              {result.driver_warnings.map((w, i) => (
                <div key={i} className="text-xs text-dark-text flex items-start gap-1.5">
                  <span className="text-brand-amber font-bold">•</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>

            {result.hotspot_segments.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-dark-border/60">
                <div className="text-[10px] uppercase font-semibold text-dark-muted">{t.hotspotsOnRoute}:</div>
                <div className="space-y-1">
                  {result.hotspot_segments.map((hs, i) => (
                    <div key={i} className="text-[11px] text-dark-muted flex items-center justify-between p-1.5 bg-dark-bg rounded border border-dark-border/40">
                      <span>{hs.description}</span>
                      <span className="font-mono text-brand-amber font-semibold">{hs.crash_count} ПТП</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
