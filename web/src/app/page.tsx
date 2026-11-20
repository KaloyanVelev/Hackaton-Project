"use client";

import React, { useEffect, useState, useCallback } from "react";
import { MapCanvas } from "@/components/MapCanvas";
import { CrashDetailCard } from "@/components/CrashDetailCard";
import { CrashFeatureCollection } from "@/lib/schemas";

export default function Home() {
  const [crashesData, setCrashesData] = useState<CrashFeatureCollection | null>(null);
  const [selectedCrashId, setSelectedCrashId] = useState<number | null>(null);

  const loadCrashes = useCallback(() => {
    fetch("/api/crashes?limit=10000")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.features) setCrashesData(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCrashes();
  }, [loadCrashes]);

  return (
    <main className="w-screen h-screen overflow-hidden relative bg-dark-bg font-sans">
      <div className="fixed top-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 bg-dark-bg/92 backdrop-blur-md border border-dark-border rounded-xl shadow-xl text-dark-text text-xs">
        <div className="w-2.5 h-2.5 rounded-full bg-brand-amber animate-pulse" />
        <span className="font-bold tracking-wide">StreetAware</span>
        <span className="text-[11px] text-dark-muted font-mono bg-dark-panel px-1.5 py-0.5 rounded border border-dark-border">
          {crashesData?.features?.length || 0}
        </span>
      </div>

      <MapCanvas
        crashesData={crashesData}
        hotspotsData={null}
        showHotspots={false}
        tripGeoJson={null}
        mapVariant="white"
        layerMode="auto"
        dotSize={5.5}
        dotOpacity={0.85}
        heatmapIntensity={1.2}
        heatmapRadius={24}
        fatalColor="red"
        flyToLocation={null}
        onSelectCrash={(id) => setSelectedCrashId(id)}
      />

      <CrashDetailCard
        crashId={selectedCrashId}
        onClose={() => setSelectedCrashId(null)}
        lang="bg"
      />
    </main>
  );
}
