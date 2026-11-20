"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, ExternalLink, TrendingUp, AlertTriangle, Clock, MapPin, Calendar, Compass, ShieldAlert } from "lucide-react";
import type { AggregatedStats } from "@/lib/crashes";
import { copy, count, type Language, dayNames, monthNames, crashType } from "@/lib/language";

interface StatsDropdownProps {
  language: Language;
  snapshotId: string | null;
  onClose: () => void;
}

export function StatsDropdown({ language, snapshotId, onClose }: StatsDropdownProps) {
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const t = copy[language];

  // Fetch stats from API
  useEffect(() => {
    let ignore = false;
    async function loadStats() {
      try {
        setLoading(true);
        const url = snapshotId ? `/api/stats?snapshot=${snapshotId}` : "/api/stats";
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load statistics");
        const data = await res.json() as { stats: AggregatedStats };
        if (!ignore) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void loadStats();
    return () => { ignore = true; };
  }, [snapshotId]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // ESC to close
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const totalCards = 7;

  const nextCard = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % totalCards);
  }, [totalCards]);

  const prevCard = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + totalCards) % totalCards);
  }, [totalCards]);

  // Auto-rotate every 5s unless hovered/paused
  useEffect(() => {
    if (isPaused || loading || !stats) return;
    const timer = setInterval(nextCard, 5000);
    return () => clearInterval(timer);
  }, [isPaused, loading, stats, nextCard]);

  // Slide content generator
  function renderSlideContent(index: number) {
    if (!stats) return null;

    switch (index) {
      case 0: {
        // Hourly risk
        const peak = [...stats.hourly].sort((a, b) => b.count - a.count)[0];
        const nightFatalRatio = stats.hourly.find((h) => h.hour === 3);
        return (
          <div className="stat-card-body">
            <div className="stat-badge"><Clock size={14} /> {t.chart2Title}</div>
            <div className="stat-hero-number">
              {peak ? `${peak.hour}:00` : "17:00"}
              <span className="stat-hero-label">{t.kpiPeakRiskHour}</span>
            </div>
            <p className="stat-summary-text">
              {peak ? count(language, peak.count) : "7,413"} {t.crashes.toLowerCase()} ({peak ? count(language, peak.deaths) : "101"} {t.deaths.toLowerCase()}).
              {language === "bg" ? " Нощните часове (02:00–04:00) носят най-висока смъртност на инцидент." : " Night hours (02:00–04:00) show highest lethality per crash."}
            </p>
            {/* Mini sparkline */}
            <div className="mini-bars" aria-hidden="true">
              {stats.hourly.map((h) => {
                const max = Math.max(...stats.hourly.map((x) => x.count), 1);
                const heightPercent = Math.round((h.count / max) * 100);
                const isPeak = h.hour === peak?.hour;
                return (
                  <div
                    key={h.hour}
                    className={`mini-bar ${isPeak ? "highlight" : ""}`}
                    style={{ height: `${Math.max(heightPercent, 12)}%` }}
                    title={`${h.hour}:00 - ${h.count} crashes`}
                  />
                );
              })}
            </div>
          </div>
        );
      }
      case 1: {
        // Crash type & severity
        const topType = stats.crashTypes[0];
        const pedestrian = stats.crashTypes.find((c) => c.type.includes("пешеходец"));
        return (
          <div className="stat-card-body">
            <div className="stat-badge"><AlertTriangle size={14} /> {t.chart1Title}</div>
            <div className="stat-hero-number">
              {pedestrian ? count(language, pedestrian.deaths) : "240"}
              <span className="stat-hero-label">{language === "bg" ? "Загинали пешеходци" : "Pedestrian Fatalities"}</span>
            </div>
            <p className="stat-summary-text">
              {pedestrian ? `${crashType(language, pedestrian.type)}: ${count(language, pedestrian.count)} инцидента, но най-много смъртни случаи.` : ""}
              <br />
              <small>{language === "bg" ? "Най-често ПТП:" : "Most frequent:"} {topType ? crashType(language, topType.type) : ""}</small>
            </p>
          </div>
        );
      }
      case 2: {
        // Regions
        const sofia = stats.regions.find((r) => r.region?.includes("СОФИЯ"));
        const plovdiv = stats.regions.find((r) => r.region?.includes("ПЛОВДИВ"));
        return (
          <div className="stat-card-body">
            <div className="stat-badge"><MapPin size={14} /> {t.chart3Title}</div>
            <div className="stat-hero-number">
              {sofia ? count(language, sofia.count) : "27,549"}
              <span className="stat-hero-label">{language === "bg" ? "ПТП в София (№1 по обем)" : "Crashes in Sofia (#1 Volume)"}</span>
            </div>
            <p className="stat-summary-text">
              {language === "bg"
                ? `В Пловдив има най-много загинали (${plovdiv ? count(language, plovdiv.deaths) : "145"}), въпреки трикратно по-малко инциденти.`
                : `Plovdiv recorded the highest fatalities (${plovdiv ? count(language, plovdiv.deaths) : "145"}), despite 3x fewer total crashes.`}
            </p>
          </div>
        );
      }
      case 3: {
        // Weekday vs weekend
        const sat = stats.dayOfWeek.find((d) => d.day === 6);
        return (
          <div className="stat-card-body">
            <div className="stat-badge"><Calendar size={14} /> {t.chart4Title}</div>
            <div className="stat-hero-number">
              {sat ? count(language, sat.deaths) : "239"}
              <span className="stat-hero-label">{language === "bg" ? "Загинали в събота" : "Saturday Deaths"}</span>
            </div>
            <p className="stat-summary-text">
              {language === "bg"
                ? "В събота има по-малко ПТП спрямо работните дни, но най-висок брой фатални изходи."
                : "Saturday has fewer total accidents than weekdays, but peak mortality."}
            </p>
          </div>
        );
      }
      case 4: {
        // Urban vs Rural
        const urban = stats.urbanRural.find((u) => u.place.includes("в населено"));
        const rural = stats.urbanRural.find((u) => u.place.includes("извън"));
        return (
          <div className="stat-card-body">
            <div className="stat-badge"><Compass size={14} /> {t.chart5Title}</div>
            <div className="stat-hero-number">
              70.7%
              <span className="stat-hero-label">{t.urbanPlace}</span>
            </div>
            <p className="stat-summary-text">
              {urban ? `${count(language, urban.count)} в града` : ""} vs{" "}
              {rural ? `${count(language, rural.count)} извън града` : ""}.
              {language === "bg"
                ? " Извънградските инциденти са значително по-тежки поради по-високата скорост."
                : " Rural crashes carry far higher fatality severity due to highway speed."}
            </p>
          </div>
        );
      }
      case 5: {
        // Monthly
        const summerPeak = stats.monthly.find((m) => m.month === 7);
        return (
          <div className="stat-card-body">
            <div className="stat-badge"><TrendingUp size={14} /> {t.chart6Title}</div>
            <div className="stat-hero-number">
              {summerPeak ? count(language, summerPeak.count) : "9,742"}
              <span className="stat-hero-label">{language === "bg" ? "ПТП през Юли (Летен пик)" : "Crashes in July (Summer Peak)"}</span>
            </div>
            <p className="stat-summary-text">
              {language === "bg"
                ? "Юли и Август бележат пик на пътуванията към морето и международен транзит с над 150 загинали/месец."
                : "July and August experience summer vacation surges with over 150 fatalities per month."}
            </p>
          </div>
        );
      }
      case 6: {
        // Infrastructure
        const topFeature = stats.roadFeatures[0];
        return (
          <div className="stat-card-body">
            <div className="stat-badge"><ShieldAlert size={14} /> {t.chart7Title}</div>
            <div className="stat-hero-number">
              {topFeature ? count(language, topFeature.count) : "2,383"}
              <span className="stat-hero-label">{language === "bg" ? "На пешеходна пътека" : "At Crosswalks"}</span>
            </div>
            <p className="stat-summary-text">
              {language === "bg"
                ? "Очертаните пешеходни пътеки и стеснените участъци са сред най-честите инфраструктурни рискови фактори."
                : "Marked crosswalks and narrowed road sections represent the most frequent infrastructure risks."}
            </p>
          </div>
        );
      }
      default:
        return null;
    }
  }

  return (
    <div
      ref={cardRef}
      className="stats-dropdown-card"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="dialog"
      aria-label={t.stats}
    >
      <div className="stats-dropdown-header">
        <div className="stats-dropdown-title">
          <TrendingUp size={16} className="stat-icon-brand" />
          <span>{t.stats}</span>
          <span className="stat-carousel-indicator">
            {activeIndex + 1} / {totalCards}
          </span>
        </div>
        <button
          type="button"
          className="stats-close-btn"
          onClick={onClose}
          aria-label={t.close}
          title={t.close}
        >
          <X size={15} />
        </button>
      </div>

      <div className="stats-carousel-viewport">
        {loading ? (
          <div className="stats-loading-box">
            <div className="spinner" />
            <span>{t.loading}</span>
          </div>
        ) : (
          renderSlideContent(activeIndex)
        )}
      </div>

      {/* Rotation navigation & dots */}
      <div className="stats-carousel-nav">
        <button
          type="button"
          className="carousel-arrow-btn"
          onClick={prevCard}
          aria-label={t.prevStat}
          title={t.prevStat}
        >
          <ChevronLeft size={16} />
        </button>

        <div className="carousel-dots" role="tablist">
          {Array.from({ length: totalCards }).map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`${t.statSlide} ${i + 1}`}
              className={`carousel-dot ${i === activeIndex ? "active" : ""}`}
              onClick={() => setActiveIndex(i)}
            />
          ))}
        </div>

        <button
          type="button"
          className="carousel-arrow-btn"
          onClick={nextCard}
          aria-label={t.nextStat}
          title={t.nextStat}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Link to /stats */}
      <div className="stats-dropdown-footer">
        <Link href="/stats" className="see-all-stats-btn" onClick={onClose}>
          <span>{t.seeAll}</span>
          <ExternalLink size={14} />
        </Link>
      </div>
    </div>
  );
}
