"use client";

import React, { useState } from "react";
import { Sliders, X } from "lucide-react";
import { DICTIONARY, Language } from "@/lib/i18n";
import { MapVariant } from "@/lib/map-styles";

interface CustomisePanelProps {
  lang: Language;
  mapVariant: MapVariant;
  onSelectMapVariant: (v: MapVariant) => void;
  layerMode: "auto" | "heatmap" | "bubbles" | "both";
  onSelectLayerMode: (m: "auto" | "heatmap" | "bubbles" | "both") => void;
  dotSize: number;
  onChangeDotSize: (size: number) => void;
  dotOpacity: number;
  onChangeDotOpacity: (opacity: number) => void;
  heatmapIntensity: number;
  onChangeHeatmapIntensity: (val: number) => void;
  heatmapRadius: number;
  onChangeHeatmapRadius: (val: number) => void;
  fatalColor: "red" | "amber" | "crimson";
  onChangeFatalColor: (color: "red" | "amber" | "crimson") => void;
}

export function CustomisePanel({
  lang,
  mapVariant,
  onSelectMapVariant,
  layerMode,
  onSelectLayerMode,
  dotSize,
  onChangeDotSize,
  dotOpacity,
  onChangeDotOpacity,
  heatmapIntensity,
  onChangeHeatmapIntensity,
  heatmapRadius,
  onChangeHeatmapRadius,
  fatalColor,
  onChangeFatalColor,
}: CustomisePanelProps) {
  const [open, setOpen] = useState(false);
  const t = DICTIONARY[lang];

  return (
    <div className="fixed top-4 right-14 z-30">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 bg-dark-bg/92 hover:bg-dark-panel backdrop-blur-md border border-dark-border rounded-xl text-xs font-medium text-dark-text shadow-xl transition-all"
      >
        <Sliders className="w-3.5 h-3.5 text-brand-amber" />
        <span>{t.customise}</span>
      </button>

      {open && (
        <div className="absolute top-11 right-0 w-80 bg-dark-bg/95 backdrop-blur-md border border-dark-border rounded-xl shadow-2xl p-4 text-dark-text animate-in fade-in slide-in-from-top-2 space-y-3.5 text-xs">
          <div className="flex items-center justify-between border-b border-dark-border pb-2">
            <span className="font-semibold text-sm tracking-wide">{t.customise}</span>
            <button
              onClick={() => setOpen(false)}
              className="text-dark-muted hover:text-dark-text p-1 rounded-md hover:bg-dark-panel transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-dark-muted mb-1.5">{t.mapVariant}</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["white", "dark", "geo", "satellite"] as MapVariant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => onSelectMapVariant(v)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors text-center ${
                    mapVariant === v
                      ? "bg-brand-amber/15 border-brand-amber text-brand-amber"
                      : "bg-dark-panel border-dark-border text-dark-muted hover:text-dark-text"
                  }`}
                >
                  {v === "white" && t.styleWhite}
                  {v === "dark" && t.styleDark}
                  {v === "geo" && t.styleGeo}
                  {v === "satellite" && t.styleSatellite}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-dark-muted mb-1.5">{t.layerMode}</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["auto", "heatmap", "bubbles", "both"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onSelectLayerMode(m)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors text-center ${
                    layerMode === m
                      ? "bg-brand-amber/15 border-brand-amber text-brand-amber"
                      : "bg-dark-panel border-dark-border text-dark-muted hover:text-dark-text"
                  }`}
                >
                  {m === "auto" && t.modeAuto}
                  {m === "heatmap" && t.modeHeatmap}
                  {m === "bubbles" && t.modeBubbles}
                  {m === "both" && t.modeBoth}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 pt-1 border-t border-dark-border/60">
            <div>
              <div className="flex items-center justify-between text-[11px] text-dark-muted mb-1">
                <span>{t.dotSize}</span>
                <span className="font-mono text-dark-text">{dotSize}px</span>
              </div>
              <input
                type="range"
                min="2"
                max="14"
                step="0.5"
                value={dotSize}
                onChange={(e) => onChangeDotSize(Number(e.target.value))}
                className="w-full accent-brand-amber"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-dark-muted mb-1">
                <span>{t.dotOpacity}</span>
                <span className="font-mono text-dark-text">{Math.round(dotOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={dotOpacity}
                onChange={(e) => onChangeDotOpacity(Number(e.target.value))}
                className="w-full accent-brand-amber"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-dark-muted mb-1">
                <span>{t.heatmapIntensity}</span>
                <span className="font-mono text-dark-text">{heatmapIntensity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="3.0"
                step="0.1"
                value={heatmapIntensity}
                onChange={(e) => onChangeHeatmapIntensity(Number(e.target.value))}
                className="w-full accent-brand-amber"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] text-dark-muted mb-1">
                <span>{t.heatmapRadius}</span>
                <span className="font-mono text-dark-text">{heatmapRadius}px</span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="2"
                value={heatmapRadius}
                onChange={(e) => onChangeHeatmapRadius(Number(e.target.value))}
                className="w-full accent-brand-amber"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-dark-border/60">
            <label className="block text-[11px] font-medium text-dark-muted mb-1.5">{t.fatalColor}</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["red", "amber", "crimson"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => onChangeFatalColor(c)}
                  className={`py-1 px-2 rounded-lg border text-[11px] font-medium transition-colors text-center ${
                    fatalColor === c
                      ? "bg-dark-panel border-dark-text text-dark-text"
                      : "bg-dark-panel/60 border-dark-border text-dark-muted"
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{
                    backgroundColor: c === "red" ? "#EF4444" : c === "amber" ? "#F59E0B" : "#BE123C"
                  }} />
                  {c === "red" && t.colorRed}
                  {c === "amber" && t.colorAmber}
                  {c === "crimson" && t.colorCrimson}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
