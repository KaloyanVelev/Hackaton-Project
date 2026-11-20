"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Clock, Compass, ExternalLink, MapPin, ShieldAlert, TrendingUp, X } from "lucide-react";
import { crashLocationCounts, formatStatsSummary, validateStatsPayload, type AggregatedStats } from "@/lib/crashes";
import { copy, count, crashType, dayNames, monthNames, type Language } from "@/lib/language";

const totalCards = 7;

function Statistic({ stats, index, language }: { stats: AggregatedStats; index: number; language: Language }) {
  const t = copy[language];
  const { peakHour: hour, topCrashType: type, topRegion: region, deadliestDay: day, peakMonth: month, topFeature: feature } =
    formatStatsSummary(stats);
  const { urban, rural } = crashLocationCounts(stats.urbanRural);
  const placeTotal = urban + rural;
  const number = (value: number) => count(language, value);
  const crashes = (value: number) => `${t.legendCrashes} · ${number(value)}`;
  const deaths = (value: number) => `${t.legendDeaths} · ${number(value)}`;
  const cards = [
    { title: t.chart2Title, icon: Clock, value: hour && `${String(hour.hour).padStart(2, "0")}:00`,
      label: t.kpiPeakCrashHour, detail: hour && `${crashes(hour.count)} / ${deaths(hour.deaths)}` },
    { title: t.chart1Title, icon: AlertTriangle, value: type && number(type.count),
      label: t.legendCrashes, detail: type && crashType(language, type.type) },
    { title: t.chart3Title, icon: MapPin, value: region && number(region.count),
      label: t.legendCrashes, detail: region && `${region.region} · ${deaths(region.deaths)}` },
    { title: t.chart4Title, icon: Calendar, value: day && number(day.deaths),
      label: t.legendDeaths, detail: day && dayNames[language][day.day - 1] },
    { title: t.chart5Title, icon: Compass,
      value: placeTotal ? new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 1 }).format(urban / placeTotal) : null,
      label: t.urbanPlace, detail: `${t.urbanPlace} · ${number(urban)} / ${t.ruralPlace} · ${number(rural)}` },
    { title: t.chart6Title, icon: TrendingUp, value: month && number(month.count),
      label: t.legendCrashes, detail: month && `${monthNames[language][month.month - 1]} · ${deaths(month.deaths)}` },
    { title: t.chart7Title, icon: ShieldAlert, value: feature && number(feature.count),
      label: t.legendCrashes, detail: feature && feature.feature },
  ];
  const { title, icon: Icon, value, label, detail } = cards[index];

  return (
    <div className="stat-card-body">
      <div className="stat-badge"><Icon size={14} aria-hidden="true" />{title}</div>
      {value === null ? <p className="stat-summary-text">{t.noStats}</p> : (
        <>
          <div className="stat-hero-number">{value}<span className="stat-hero-label">{label}</span></div>
          {detail && <p className="stat-summary-text">{detail}</p>}
          {index === 0 && hour && (
            <div className="mini-bars" aria-hidden="true">
              {stats.hourly.map(({ hour: bucket, count }) => (
                <div key={bucket} className={`mini-bar${bucket === hour.hour ? " highlight" : ""}`}
                  style={{ height: `${Math.max(12, count / Math.max(hour.count, 1) * 100)}%` }} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function StatsDropdown({ language, snapshotId, boundaryRef, triggerRef, onClose }: {
  language: Language;
  snapshotId: string | null;
  boundaryRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const t = copy[language];

  useEffect(() => {
    const controller = new AbortController();
    async function loadStats() {
      setLoading(true);
      setError(false);
      setStats(null);
      try {
        const url = snapshotId ? `/api/stats?snapshot=${snapshotId}` : "/api/stats";
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load statistics.");
        const { stats } = await res.json();
        if (!validateStatsPayload(stats)) throw new Error("Invalid statistics.");
        if (!controller.signal.aborted) setStats(stats);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadStats();
    return () => controller.abort();
  }, [snapshotId]);

  const closeAndFocus = useCallback(() => {
    onClose();
    triggerRef.current?.focus();
  }, [onClose, triggerRef]);

  useEffect(() => {
    function handleOutside(event: PointerEvent) {
      if (event.target instanceof Node && !boundaryRef.current?.contains(event.target)) onClose();
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeAndFocus();
    }
    document.addEventListener("pointerdown", handleOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [boundaryRef, closeAndFocus, onClose]);

  const next = useCallback(() => setActiveIndex((prev) => (prev + 1) % totalCards), []);
  const previous = () => setActiveIndex((prev) => (prev - 1 + totalCards) % totalCards);

  useEffect(() => {
    if (isPaused || loading || !stats || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(next, 5000);
    return () => window.clearInterval(timer);
  }, [isPaused, loading, stats, next]);

  return (
    <div id="stats-dropdown" className="stats-dropdown-card" role="dialog" aria-label={t.stats}
      onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
      <div className="stats-dropdown-header">
        <div className="stats-dropdown-title">
          <TrendingUp size={16} className="stat-icon-brand" aria-hidden="true" />
          <span>{t.stats}</span>
          <span className="stat-carousel-indicator">{activeIndex + 1} / {totalCards}</span>
        </div>
        <button type="button" className="stats-close-btn" onClick={closeAndFocus} aria-label={t.close}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="stats-carousel-viewport">
        {loading && <div className="stats-loading-box" role="status"><div className="spinner" /><span>{t.loading}</span></div>}
        {error && <p className="stat-summary-text" role="alert">{t.statsError}</p>}
        {stats && <Statistic key={activeIndex} stats={stats} index={activeIndex} language={language} />}
      </div>
      <div className="stats-carousel-nav">
        <button type="button" className="carousel-arrow-btn" onClick={previous} aria-label={t.prevStat}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <div className="carousel-dots" role="group" aria-label={t.stats}>
          {Array.from({ length: totalCards }, (_, i) => (
            <button key={i} type="button" aria-pressed={i === activeIndex} aria-label={`${t.statSlide} ${i + 1}`}
              className={`carousel-dot${i === activeIndex ? " active" : ""}`} onClick={() => setActiveIndex(i)} />
          ))}
        </div>
        <button type="button" className="carousel-arrow-btn" onClick={next} aria-label={t.nextStat}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="stats-dropdown-footer">
        <Link href="/stats" className="see-all-stats-btn" onClick={onClose}>
          <span>{t.seeAll}</span><ExternalLink size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
