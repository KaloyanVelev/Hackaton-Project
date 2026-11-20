"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Filter,
  RotateCcw,
  BarChart2,
  Navigation,
  Bot,
  Flame,
  AlertCircle,
} from "lucide-react";
import { DICTIONARY, Language } from "@/lib/i18n";
import { MunicipalityItem } from "@/lib/schemas";

interface FilterPanelProps {
  lang: Language;
  municipalities: MunicipalityItem[];
  selectedMuni: string;
  onSelectMuni: (muni: string) => void;
  selectedMonth: number | "";
  onSelectMonth: (month: number | "") => void;
  selectedDay: number | "";
  onSelectDay: (day: number | "") => void;
  hourFrom: number;
  hourTo: number;
  onHourChange: (from: number, to: number) => void;
  selectedType: string;
  onSelectType: (type: string) => void;
  fatalOnly: boolean;
  onToggleFatal: (fatal: boolean) => void;
  showHotspots: boolean;
  onToggleHotspots: (show: boolean) => void;
  onClearFilters: () => void;
  visibleCount: number;
  onOpenAnalytics: () => void;
  onOpenTrip: () => void;
  onOpenChat: () => void;
}

export function FilterPanel({
  lang,
  municipalities,
  selectedMuni,
  onSelectMuni,
  selectedMonth,
  onSelectMonth,
  selectedDay,
  onSelectDay,
  hourFrom,
  hourTo,
  onHourChange,
  selectedType,
  onSelectType,
  fatalOnly,
  onToggleFatal,
  showHotspots,
  onToggleHotspots,
  onClearFilters,
  visibleCount,
  onOpenAnalytics,
  onOpenTrip,
  onOpenChat,
}: FilterPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const t = DICTIONARY[lang];

  const crashTypes = [
    "Сблъсък между МПС",
    "Блъскане на пешеходец",
    "Преобръщане на МПС",
    "Удар в крайпътно съоръжение",
    "Удар в дърво/стълб",
    "Блъскане на велосипедист",
    "Друг вид ПТП",
  ];

  const monthNamesBg = ["Януари", "Февруари", "Март", "Април", "Май", "Юни", "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"];
  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNames = lang === "bg" ? monthNamesBg : monthNamesEn;

  const dayNamesBg = ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];
  const dayNamesEn = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayNames = lang === "bg" ? dayNamesBg : dayNamesEn;

  return (
    <div className="fixed top-4 left-4 z-30 w-80 bg-dark-bg/92 backdrop-blur-md border border-dark-border rounded-xl shadow-2xl text-dark-text transition-all duration-200">
      <div className="p-3.5 flex items-center justify-between border-b border-dark-border">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-amber animate-pulse" />
          <span className="font-bold text-sm tracking-wide">{t.appTitle}</span>
          <span className="text-[10px] text-dark-muted font-mono bg-dark-panel px-1.5 py-0.5 rounded border border-dark-border">
            {visibleCount}
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-dark-muted hover:text-dark-text p-1 rounded-md hover:bg-dark-panel transition-colors"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-3.5 space-y-3 text-xs max-h-[calc(100vh-140px)] overflow-y-auto">
          <div>
            <label className="block text-[11px] font-medium text-dark-muted mb-1">{t.municipality}</label>
            <select
              value={selectedMuni}
              onChange={(e) => onSelectMuni(e.target.value)}
              className="w-full bg-dark-panel border border-dark-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-amber"
            >
              <option value="">{t.allMunicipalities}</option>
              {municipalities.map((m) => (
                <option key={m.municipality} value={m.municipality}>
                  {m.municipality} ({m.total_crashes})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-dark-muted mb-1">{t.month}</label>
              <select
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-dark-panel border border-dark-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-amber"
              >
                <option value="">{t.allMonths}</option>
                {monthNames.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-dark-muted mb-1">{t.dayOfWeek}</label>
              <select
                value={selectedDay}
                onChange={(e) => onSelectDay(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-dark-panel border border-dark-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-brand-amber"
              >
                <option value="">{t.allDays}</option>
                {dayNames.map((d, idx) => (
                  <option key={idx} value={idx}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-medium text-dark-muted mb-1">
              <span>{t.hourRange}</span>
              <span className="font-mono text-dark-text">
                {String(hourFrom).padStart(2, "0")}:00 – {String(hourTo).padStart(2, "0")}:00
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="range"
                min="0"
                max="23"
                value={hourFrom}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onHourChange(Math.min(val, hourTo), hourTo);
                }}
                className="accent-brand-amber"
              />
              <input
                type="range"
                min="0"
                max="23"
                value={hourTo}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onHourChange(hourFrom, Math.max(val, hourFrom));
                }}
                className="accent-brand-amber"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-dark-muted mb-1">{t.crashType}</label>
            <select
              value={selectedType}
              onChange={(e) => onSelectType(e.target.value)}
              className="w-full bg-dark-panel border border-dark-border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-amber"
            >
              <option value="">{t.allCrashTypes}</option>
              {crashTypes.map((ct) => (
                <option key={ct} value={ct}>{ct}</option>
              ))}
            </select>
          </div>

          <div className="pt-1 space-y-2 border-t border-dark-border/60">
            <label className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-[11px] font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-brand-fatal" />
                {t.fatalOnly}
              </span>
              <input
                type="checkbox"
                checked={fatalOnly}
                onChange={(e) => onToggleFatal(e.target.checked)}
                className="w-4 h-4 rounded bg-dark-panel border-dark-border accent-brand-fatal cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer py-1">
              <span className="text-[11px] font-medium flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-brand-amber" />
                {t.showHotspots}
              </span>
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={(e) => onToggleHotspots(e.target.checked)}
                className="w-4 h-4 rounded bg-dark-panel border-dark-border accent-brand-amber cursor-pointer"
              />
            </label>
          </div>

          <button
            onClick={onClearFilters}
            className="w-full py-1.5 text-[11px] text-dark-muted hover:text-dark-text bg-dark-panel hover:bg-dark-border/60 border border-dark-border rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            {t.clearFilters}
          </button>

          <div className="pt-2 border-t border-dark-border flex flex-col gap-1.5">
            <button
              onClick={onOpenAnalytics}
              className="w-full py-2 px-3 text-xs font-semibold bg-dark-panel hover:bg-dark-border/70 border border-dark-border rounded-lg transition-all flex items-center justify-center gap-2 text-dark-text shadow-sm"
            >
              <BarChart2 className="w-4 h-4 text-brand-amber" />
              {t.btnCharts}
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={onOpenTrip}
                className="py-1.5 px-2 text-[11px] font-medium bg-dark-panel hover:bg-dark-border/60 border border-dark-border rounded-lg transition-colors flex items-center justify-center gap-1.5 text-dark-text"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                {t.btnTrip}
              </button>
              <button
                onClick={onOpenChat}
                className="py-1.5 px-2 text-[11px] font-medium bg-dark-panel hover:bg-dark-border/60 border border-dark-border rounded-lg transition-colors flex items-center justify-center gap-1.5 text-dark-text"
              >
                <Bot className="w-3.5 h-3.5 text-sky-400" />
                {t.btnAi}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
