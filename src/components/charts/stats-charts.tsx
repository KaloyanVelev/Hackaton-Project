"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
  type ChartOptions,
} from "chart.js";
import { Bar, Line, Doughnut, Radar } from "react-chartjs-2";
import type { AggregatedStats } from "@/lib/crashes";
import { copy, type Language, dayNames, monthNames, crashType, count } from "@/lib/language";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale
);

interface ChartsProps {
  stats: AggregatedStats;
  language: Language;
}

export function StatsCharts({ stats, language }: ChartsProps) {
  const t = copy[language];

  // Common dark theme options
  const commonOptions: ChartOptions<any> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#94a3b8",
          font: { size: 12, weight: 600 },
          boxWidth: 12,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        titleColor: "#f8fafc",
        bodyColor: "#cbd5e1",
        borderColor: "rgba(255, 255, 255, 0.15)",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8", font: { size: 11 } },
        grid: { color: "rgba(255, 255, 255, 0.06)" },
      },
      y: {
        ticks: { color: "#94a3b8", font: { size: 11 } },
        grid: { color: "rgba(255, 255, 255, 0.06)" },
      },
    },
  };

  // 1. Crash Types vs Severity
  const topTypes = stats.crashTypes.slice(0, 7);
  const chart1Data = {
    labels: topTypes.map((c) => {
      const translated = crashType(language, c.type);
      return translated.length > 22 ? translated.slice(0, 20) + "…" : translated;
    }),
    datasets: [
      {
        label: t.legendCrashes,
        data: topTypes.map((c) => c.count),
        backgroundColor: "rgba(59, 130, 246, 0.75)",
        borderColor: "#3b82f6",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: t.legendInjuries,
        data: topTypes.map((c) => c.injured),
        backgroundColor: "rgba(245, 158, 11, 0.8)",
        borderColor: "#f59e0b",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: t.legendDeaths,
        data: topTypes.map((c) => c.deaths),
        backgroundColor: "rgba(239, 68, 68, 0.9)",
        borderColor: "#ef4444",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  // 2. Hourly Risk Curve
  const chart2Data = {
    labels: stats.hourly.map((h) => `${h.hour}:00`),
    datasets: [
      {
        label: t.legendCrashes,
        data: stats.hourly.map((h) => h.count),
        borderColor: "#38bdf8",
        backgroundColor: "rgba(56, 189, 248, 0.18)",
        fill: true,
        tension: 0.35,
        yAxisID: "y",
      },
      {
        label: t.legendDeaths,
        data: stats.hourly.map((h) => h.deaths),
        borderColor: "#f43f5e",
        backgroundColor: "rgba(244, 63, 94, 0.2)",
        fill: false,
        tension: 0.35,
        borderDash: [4, 4],
        yAxisID: "y1",
      },
    ],
  };

  const chart2Options: ChartOptions<"line"> = {
    ...commonOptions,
    scales: {
      x: commonOptions.scales?.x,
      y: {
        type: "linear",
        display: true,
        position: "left",
        ticks: { color: "#38bdf8" },
        grid: { color: "rgba(255, 255, 255, 0.06)" },
        title: { display: true, text: t.legendCrashes, color: "#38bdf8" },
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        ticks: { color: "#f43f5e" },
        grid: { drawOnChartArea: false },
        title: { display: true, text: t.legendDeaths, color: "#f43f5e" },
      },
    },
  };

  // 3. Top 10 Regions
  const chart3Data = {
    labels: stats.regions.map((r) => r.region),
    datasets: [
      {
        label: t.legendCrashes,
        data: stats.regions.map((r) => r.count),
        backgroundColor: "rgba(99, 102, 241, 0.75)",
        borderColor: "#6366f1",
        borderRadius: 4,
      },
      {
        label: t.legendDeaths,
        data: stats.regions.map((r) => r.deaths),
        backgroundColor: "rgba(239, 68, 68, 0.85)",
        borderColor: "#ef4444",
        borderRadius: 4,
      },
    ],
  };

  const chart3Options: ChartOptions<"bar"> = {
    ...commonOptions,
    indexAxis: "y",
  };

  // 4. Day of Week
  const chart4Data = {
    labels: dayNames[language],
    datasets: [
      {
        label: t.legendCrashes,
        data: stats.dayOfWeek.map((d) => d.count),
        backgroundColor: "rgba(14, 165, 233, 0.3)",
        borderColor: "#0ea5e9",
        borderWidth: 2,
        pointBackgroundColor: "#0ea5e9",
      },
      {
        label: `${t.legendDeaths} (x50)`,
        data: stats.dayOfWeek.map((d) => d.deaths * 50),
        backgroundColor: "rgba(244, 63, 94, 0.3)",
        borderColor: "#f43f5e",
        borderWidth: 2,
        pointBackgroundColor: "#f43f5e",
      },
    ],
  };

  const chart4Options: ChartOptions<"radar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: commonOptions.plugins,
    scales: {
      r: {
        angleLines: { color: "rgba(255, 255, 255, 0.1)" },
        grid: { color: "rgba(255, 255, 255, 0.08)" },
        pointLabels: { color: "#cbd5e1", font: { size: 12, weight: 600 } },
        ticks: { display: false },
      },
    },
  };

  // 5. Urban vs Rural
  const chart5Data = {
    labels: [t.urbanPlace, t.ruralPlace],
    datasets: [
      {
        data: stats.urbanRural.slice(0, 2).map((u) => u.count),
        backgroundColor: ["#3b82f6", "#f97316"],
        borderColor: "rgba(15, 23, 42, 0.8)",
        borderWidth: 2,
      },
    ],
  };

  // 6. Monthly / Seasonal Curve
  const chart6Data = {
    labels: monthNames[language],
    datasets: [
      {
        label: t.legendCrashes,
        data: stats.monthly.map((m) => m.count),
        backgroundColor: "rgba(16, 185, 129, 0.75)",
        borderColor: "#10b981",
        borderRadius: 4,
      },
      {
        label: t.legendDeaths,
        data: stats.monthly.map((m) => m.deaths),
        backgroundColor: "rgba(239, 68, 68, 0.85)",
        borderColor: "#ef4444",
        borderRadius: 4,
      },
    ],
  };

  // 7. Infrastructure Hazards
  const validFeatures = stats.roadFeatures.filter((f) => f.feature && f.feature.trim().length > 0).slice(0, 6);
  const chart7Data = {
    labels: validFeatures.map((f) => {
      const feat = f.feature.trim();
      return feat.length > 26 ? feat.slice(0, 24) + "…" : feat;
    }),
    datasets: [
      {
        label: t.legendCrashes,
        data: validFeatures.map((f) => f.count),
        backgroundColor: "rgba(249, 115, 22, 0.75)",
        borderColor: "#f97316",
        borderRadius: 4,
      },
      {
        label: t.legendInjuries,
        data: validFeatures.map((f) => f.injured),
        backgroundColor: "rgba(234, 179, 8, 0.75)",
        borderColor: "#eab308",
        borderRadius: 4,
      },
    ],
  };

  return (
    <div className="stats-charts-grid">
      {/* Chart 1 */}
      <div className="chart-card full-span">
        <div className="chart-card-header">
          <h3>{t.chart1Title}</h3>
          <p>{t.chart1Desc}</p>
        </div>
        <div className="chart-canvas-container">
          <Bar data={chart1Data} options={commonOptions} />
        </div>
      </div>

      {/* Chart 2 */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3>{t.chart2Title}</h3>
          <p>{t.chart2Desc}</p>
        </div>
        <div className="chart-canvas-container">
          <Line data={chart2Data} options={chart2Options} />
        </div>
      </div>

      {/* Chart 3 */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3>{t.chart3Title}</h3>
          <p>{t.chart3Desc}</p>
        </div>
        <div className="chart-canvas-container">
          <Bar data={chart3Data} options={chart3Options} />
        </div>
      </div>

      {/* Chart 4 */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3>{t.chart4Title}</h3>
          <p>{t.chart4Desc}</p>
        </div>
        <div className="chart-canvas-container radar-container">
          <Radar data={chart4Data} options={chart4Options} />
        </div>
      </div>

      {/* Chart 5 */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3>{t.chart5Title}</h3>
          <p>{t.chart5Desc}</p>
        </div>
        <div className="chart-canvas-container doughnut-container">
          <Doughnut data={chart5Data} options={commonOptions} />
        </div>
      </div>

      {/* Chart 6 */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3>{t.chart6Title}</h3>
          <p>{t.chart6Desc}</p>
        </div>
        <div className="chart-canvas-container">
          <Bar data={chart6Data} options={commonOptions} />
        </div>
      </div>

      {/* Chart 7 */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3>{t.chart7Title}</h3>
          <p>{t.chart7Desc}</p>
        </div>
        <div className="chart-canvas-container">
          <Bar data={chart7Data} options={commonOptions} />
        </div>
      </div>
    </div>
  );
}
