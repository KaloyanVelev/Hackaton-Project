"use client";

import React, { useState, useEffect } from "react";
import { X, BarChart3, AlertOctagon, Building2, ShieldCheck, MapPin, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { DICTIONARY, Language } from "@/lib/i18n";
import { ChartData, MunicipalReport, MunicipalityItem, PredictRiskResponse } from "@/lib/schemas";

interface AnalyticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  municipalities: MunicipalityItem[];
  selectedMuni: string;
  onFlyToLocation: (loc: [number, number]) => void;
}

export function AnalyticsDrawer({
  isOpen,
  onClose,
  lang,
  municipalities,
  selectedMuni,
  onFlyToLocation,
}: AnalyticsDrawerProps) {
  const [activeTab, setActiveTab] = useState<"charts" | "predictor" | "municipal">("charts");
  const [chartsData, setChartsData] = useState<ChartData | null>(null);
  const [loadingCharts, setLoadingCharts] = useState(false);

  const [predMuni, setPredMuni] = useState(selectedMuni || "Столична");
  const [predDay, setPredDay] = useState(4);
  const [predHour, setPredHour] = useState(19);
  const [predMonth, setPredMonth] = useState(11);
  const [predResult, setPredResult] = useState<PredictRiskResponse | null>(null);
  const [loadingPred, setLoadingPred] = useState(false);

  const [muniReport, setMuniReport] = useState<MunicipalReport | null>(null);
  const [reportMuni, setReportMuni] = useState(selectedMuni || "Столична");
  const [loadingReport, setLoadingReport] = useState(false);

  const t = DICTIONARY[lang];

  useEffect(() => {
    if (selectedMuni) {
      setPredMuni(selectedMuni);
      setReportMuni(selectedMuni);
    }
  }, [selectedMuni]);

  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === "charts") {
      setLoadingCharts(true);
      const url = selectedMuni
        ? `/api/charts?municipality=${encodeURIComponent(selectedMuni)}`
        : "/api/charts";
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          setChartsData(data);
          setLoadingCharts(false);
        })
        .catch(() => setLoadingCharts(false));
    } else if (activeTab === "municipal") {
      loadMunicipalReport(reportMuni);
    }
  }, [isOpen, activeTab, selectedMuni]);

  const runPrediction = async () => {
    setLoadingPred(true);
    try {
      const res = await fetch("/api/predict-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipality: predMuni,
          day_of_week: predDay,
          hour: predHour,
          month: predMonth,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setPredResult(json);
      }
    } finally {
      setLoadingPred(false);
    }
  };

  const loadMunicipalReport = async (muni: string) => {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/municipal-report?municipality=${encodeURIComponent(muni)}`);
      if (res.ok) {
        const json = await res.json();
        setMuniReport(json);
      }
    } finally {
      setLoadingReport(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl bg-dark-bg/98 backdrop-blur-xl border-l border-dark-border shadow-2xl flex flex-col text-dark-text animate-in slide-in-from-right duration-200">
      <div className="p-4 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-amber" />
          <h2 className="font-bold text-base tracking-wide">{t.btnCharts}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-dark-muted hover:text-dark-text p-1.5 rounded-lg hover:bg-dark-panel transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex border-b border-dark-border bg-dark-panel/40 px-4 pt-2 gap-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab("charts")}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "charts"
              ? "border-brand-amber text-brand-amber font-semibold"
              : "border-transparent text-dark-muted hover:text-dark-text"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          {t.tabsCharts}
        </button>
        <button
          onClick={() => {
            setActiveTab("predictor");
            if (!predResult) runPrediction();
          }}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "predictor"
              ? "border-brand-amber text-brand-amber font-semibold"
              : "border-transparent text-dark-muted hover:text-dark-text"
          }`}
        >
          <AlertOctagon className="w-4 h-4" />
          {t.tabsPredictor}
        </button>
        <button
          onClick={() => {
            setActiveTab("municipal");
            loadMunicipalReport(reportMuni);
          }}
          className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === "municipal"
              ? "border-brand-amber text-brand-amber font-semibold"
              : "border-transparent text-dark-muted hover:text-dark-text"
          }`}
        >
          <Building2 className="w-4 h-4" />
          {t.tabsMunicipal}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
        {activeTab === "charts" && (
          loadingCharts ? (
            <div className="py-20 flex justify-center items-center text-dark-muted gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-brand-amber" />
              <span>Зареждане на графики...</span>
            </div>
          ) : chartsData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-2">
                <div className="p-3 bg-dark-panel rounded-xl border border-dark-border">
                  <div className="text-[10px] text-dark-muted uppercase font-semibold">Общо ПТП</div>
                  <div className="text-xl font-bold mt-1 text-dark-text">{chartsData.totals.total_crashes}</div>
                </div>
                <div className="p-3 bg-dark-panel rounded-xl border border-dark-border">
                  <div className="text-[10px] text-brand-fatal uppercase font-semibold">Фатални</div>
                  <div className="text-xl font-bold mt-1 text-brand-fatal">{chartsData.totals.total_fatal}</div>
                </div>
                <div className="p-3 bg-dark-panel rounded-xl border border-dark-border">
                  <div className="text-[10px] text-red-400 uppercase font-semibold">Загинали</div>
                  <div className="text-xl font-bold mt-1 text-red-400">{chartsData.totals.total_killed}</div>
                </div>
                <div className="p-3 bg-dark-panel rounded-xl border border-dark-border">
                  <div className="text-[10px] text-brand-amber uppercase font-semibold">Ранени</div>
                  <div className="text-xl font-bold mt-1 text-brand-amber">{chartsData.totals.total_injured}</div>
                </div>
              </div>

              <div className="p-4 bg-dark-panel/60 rounded-xl border border-dark-border space-y-3">
                <h3 className="font-semibold text-sm text-dark-text">ПТП по часове на денонощието (00:00 – 23:00)</h3>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartsData.by_hour} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A27" />
                      <XAxis dataKey="hour" stroke="#A8A29E" fontSize={10} tickFormatter={(h) => `${h}h`} />
                      <YAxis stroke="#A8A29E" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: "#1B1B19", borderColor: "#2A2A27", borderRadius: 8, fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="total" name="Всички ПТП" fill="#38BDF8" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="fatal" name="Фатални" fill="#EF4444" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 bg-dark-panel/60 rounded-xl border border-dark-border space-y-3">
                <h3 className="font-semibold text-sm text-dark-text">ПТП по месеци (1 – 12)</h3>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartsData.by_month} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A27" />
                      <XAxis dataKey="month" stroke="#A8A29E" fontSize={10} tickFormatter={(m) => `М${m}`} />
                      <YAxis stroke="#A8A29E" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: "#1B1B19", borderColor: "#2A2A27", borderRadius: 8, fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="total" name="Всички ПТП" fill="#0284C7" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="fatal" name="Фатални" fill="#EF4444" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-4 bg-dark-panel/60 rounded-xl border border-dark-border space-y-2">
                <h3 className="font-semibold text-sm text-dark-text">Водещи видове инциденти</h3>
                <div className="space-y-1.5 pt-1">
                  {chartsData.top_crash_types.map((ct) => (
                    <div key={ct.crash_type} className="flex items-center justify-between p-2 bg-dark-bg/60 rounded-lg border border-dark-border/40">
                      <span className="text-dark-text font-medium">{ct.crash_type}</span>
                      <span className="font-mono text-xs text-brand-amber font-semibold">{ct.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null
        )}

        {activeTab === "predictor" && (
          <div className="space-y-5">
            <div className="p-4 bg-dark-panel/60 rounded-xl border border-dark-border space-y-3">
              <h3 className="font-semibold text-sm text-dark-text">{t.predictRiskTitle}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-dark-muted mb-1">{t.municipality}</label>
                  <select
                    value={predMuni}
                    onChange={(e) => setPredMuni(e.target.value)}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-dark-text focus:outline-none focus:border-brand-amber"
                  >
                    {municipalities.map((m) => (
                      <option key={m.municipality} value={m.municipality}>{m.municipality}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-dark-muted mb-1">{t.dayOfWeek}</label>
                  <select
                    value={predDay}
                    onChange={(e) => setPredDay(Number(e.target.value))}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-dark-text focus:outline-none focus:border-brand-amber"
                  >
                    {["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"].map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-dark-muted mb-1">Час ({predHour}:00)</label>
                  <input
                    type="range"
                    min="0"
                    max="23"
                    value={predHour}
                    onChange={(e) => setPredHour(Number(e.target.value))}
                    className="w-full accent-brand-amber"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-dark-muted mb-1">{t.month}</label>
                  <select
                    value={predMonth}
                    onChange={(e) => setPredMonth(Number(e.target.value))}
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-dark-text focus:outline-none focus:border-brand-amber"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>Месец {i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={runPrediction}
                disabled={loadingPred}
                className="w-full py-2 bg-brand-amber hover:bg-brand-amber/90 text-dark-bg font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {loadingPred ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {t.btnPredict}
              </button>
            </div>

            {predResult && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-dark-panel rounded-xl border border-dark-border text-center">
                    <div className="text-[10px] text-dark-muted uppercase font-semibold">Фатален риск</div>
                    <div className="text-2xl font-black mt-1 text-dark-text">{predResult.fatal_risk_pct}%</div>
                    <div className="text-[10px] text-dark-muted mt-0.5">База: {predResult.national_baseline_pct}%</div>
                  </div>
                  <div className="p-3 bg-dark-panel rounded-xl border border-dark-border text-center">
                    <div className="text-[10px] text-dark-muted uppercase font-semibold">Множител</div>
                    <div className="text-2xl font-black mt-1 text-brand-amber">{predResult.relative_risk_multiplier}x</div>
                    <div className="text-[10px] text-dark-muted mt-0.5">спрямо страната</div>
                  </div>
                  <div className="p-3 bg-dark-panel rounded-xl border border-dark-border text-center flex flex-col justify-center items-center">
                    <div className="text-[10px] text-dark-muted uppercase font-semibold">Ниво на риск</div>
                    <span className={`inline-block px-2.5 py-1 mt-1 rounded-md text-xs font-black tracking-wider uppercase ${
                      predResult.risk_tier === "CRITICAL"
                        ? "bg-brand-fatal/20 text-brand-fatal border border-brand-fatal"
                        : predResult.risk_tier === "HIGH"
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                        : predResult.risk_tier === "MODERATE"
                        ? "bg-brand-amber/20 text-brand-amber border border-brand-amber/50"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                    }`}>
                      {predResult.risk_tier}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-dark-panel/70 rounded-xl border border-dark-border space-y-2">
                  <div className="text-[11px] uppercase font-semibold text-brand-amber tracking-wider">{t.driverWarning}</div>
                  <p className="text-xs text-dark-text leading-relaxed font-medium">{predResult.driver_warning}</p>
                </div>

                <div className="p-3.5 bg-dark-panel/70 rounded-xl border border-dark-border space-y-2">
                  <div className="text-[11px] uppercase font-semibold text-dark-muted tracking-wider">{t.topFactors}</div>
                  <ul className="space-y-1">
                    {predResult.top_factors.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-dark-text">
                        <span className="text-brand-amber font-bold">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 bg-dark-panel/70 rounded-xl border border-dark-border space-y-2">
                  <div className="text-[11px] uppercase font-semibold text-emerald-400 tracking-wider">{t.municipalMeasures}</div>
                  <ul className="space-y-1.5">
                    {predResult.municipal_measures.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-dark-text">
                        <span className="text-emerald-400 font-bold shrink-0">✓</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "municipal" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <select
                value={reportMuni}
                onChange={(e) => {
                  setReportMuni(e.target.value);
                  loadMunicipalReport(e.target.value);
                }}
                className="flex-1 bg-dark-panel border border-dark-border rounded-lg px-3 py-2 text-xs text-dark-text focus:outline-none focus:border-brand-amber font-semibold"
              >
                {municipalities.map((m) => (
                  <option key={m.municipality} value={m.municipality}>{m.municipality}</option>
                ))}
              </select>
            </div>

            {loadingReport ? (
              <div className="py-20 flex justify-center items-center text-dark-muted gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand-amber" />
                <span>Генериране на общински отчет...</span>
              </div>
            ) : muniReport ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 bg-dark-panel rounded-xl border border-dark-border text-center">
                    <div className="text-[10px] text-dark-muted uppercase font-semibold">Катастрофи</div>
                    <div className="text-xl font-bold mt-1 text-dark-text">{muniReport.total_crashes}</div>
                  </div>
                  <div className="p-3 bg-dark-panel rounded-xl border border-dark-border text-center">
                    <div className="text-[10px] text-brand-fatal uppercase font-semibold">Фатални</div>
                    <div className="text-xl font-bold mt-1 text-brand-fatal">{muniReport.total_fatal}</div>
                  </div>
                  <div className="p-3 bg-dark-panel rounded-xl border border-dark-border text-center">
                    <div className="text-[10px] text-dark-muted uppercase font-semibold">Пътна мрежа</div>
                    <div className="text-xl font-bold mt-1 text-dark-text">{Math.round(muniReport.regional_road_length_km)} км</div>
                  </div>
                </div>

                <div className="p-4 bg-dark-panel/60 rounded-xl border border-dark-border space-y-3">
                  <h4 className="font-semibold text-xs text-dark-text">Топ 5 черни точки (зони на концентрация)</h4>
                  <div className="space-y-2">
                    {muniReport.top_blackspots.map((b, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-dark-bg/60 rounded-lg border border-dark-border/40">
                        <div>
                          <div className="font-medium text-dark-text">{b.label}</div>
                          <div className="text-[10px] text-dark-muted font-mono">{b.lat}, {b.lon}</div>
                        </div>
                        <button
                          onClick={() => {
                            onFlyToLocation([b.lat, b.lon]);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-dark-panel hover:bg-dark-border border border-dark-border rounded text-[11px] font-medium text-brand-amber flex items-center gap-1 transition-colors"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>На картата</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-dark-panel/60 rounded-xl border border-dark-border space-y-2.5">
                  <h4 className="font-semibold text-xs text-dark-text">Препоръчителни мерки за общината</h4>
                  <ul className="space-y-2">
                    {muniReport.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-dark-text leading-relaxed">
                        <span className="text-brand-amber font-bold shrink-0">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
