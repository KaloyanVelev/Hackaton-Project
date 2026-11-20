"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Globe2, ShieldAlert, Users, Skull, Activity, AlertCircle } from "lucide-react";
import type { AggregatedStats } from "@/lib/crashes";
import { copy, count, type Language } from "@/lib/language";
import { StatsCharts } from "@/components/charts/stats-charts";

export default function StatsPage() {
  const [language, setLanguage] = useState<Language>("bg");
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = copy[language];

  useEffect(() => {
    document.title = `Street Aware | ${t.dashboardTitle}`;
    document.documentElement.lang = language;
  }, [language, t.dashboardTitle]);

  useEffect(() => {
    let ignore = false;
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error("Could not load statistics.");
        const data = await res.json() as { stats: AggregatedStats };
        if (!ignore) {
          setStats(data.stats);
        }
      } catch (err: any) {
        if (!ignore) setError(err.message || "Failed to load data");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void fetchStats();
    return () => { ignore = true; };
  }, []);

  return (
    <div className="stats-page-root">
      {/* Top Navigation */}
      <header className="stats-top-nav">
        <div className="stats-nav-left">
          <Link href="/" className="back-map-link">
            <ArrowLeft size={18} />
            <span>{t.backToMap}</span>
          </Link>
          <div className="stats-brand-divider" />
          <Link href="/" className="stats-brand-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/streets.png" width="145" height="25" alt="Street Aware" />
          </Link>
        </div>

        <button
          type="button"
          className="language-button"
          onClick={() => setLanguage(language === "bg" ? "en" : "bg")}
          aria-label={t.language}
        >
          <Globe2 size={16} />
          <span>{language === "bg" ? "EN" : "BG"}</span>
        </button>
      </header>

      <main className="stats-main-content">
        {/* Hero Section */}
        <div className="stats-hero">
          <h1>{t.dashboardTitle}</h1>
          <p className="stats-subtitle">{t.dashboardSubtitle}</p>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="stats-loading-banner">
            <div className="spinner" />
            <p>{t.loading}</p>
          </div>
        )}

        {error && (
          <div className="stats-error-banner" role="alert">
            <AlertCircle size={20} />
            <p>{error}</p>
            <button type="button" onClick={() => window.location.reload()} className="action-button">
              {t.retry}
            </button>
          </div>
        )}

        {stats && (
          <>
            {/* KPI Cards Row */}
            <div className="stats-kpi-grid">
              <div className="kpi-card">
                <div className="kpi-icon kpi-blue">
                  <Activity size={20} />
                </div>
                <div className="kpi-meta">
                  <span className="kpi-label">{t.kpiTotalCrashes}</span>
                  <span className="kpi-value">{count(language, stats.totals.totalCrashes)}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon kpi-red">
                  <Skull size={20} />
                </div>
                <div className="kpi-meta">
                  <span className="kpi-label">{t.kpiFatalities}</span>
                  <span className="kpi-value">{count(language, stats.totals.totalDeaths)}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon kpi-amber">
                  <Users size={20} />
                </div>
                <div className="kpi-meta">
                  <span className="kpi-label">{t.kpiInjuries}</span>
                  <span className="kpi-value">{count(language, stats.totals.totalInjured)}</span>
                </div>
              </div>

              <div className="kpi-card">
                <div className="kpi-icon kpi-orange">
                  <ShieldAlert size={20} />
                </div>
                <div className="kpi-meta">
                  <span className="kpi-label">{t.kpiPeakRiskHour}</span>
                  <span className="kpi-value">17:00 ч.</span>
                </div>
              </div>
            </div>

            {/* The 7 Interactive Visualizations */}
            <StatsCharts stats={stats} language={language} />
          </>
        )}
      </main>
    </div>
  );
}
