"use client";

import React, { useEffect, useState, useCallback } from "react";
import { MapCanvas } from "@/components/MapCanvas";
import { FilterPanel } from "@/components/FilterPanel";
import { CustomisePanel } from "@/components/CustomisePanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { CrashDetailCard } from "@/components/CrashDetailCard";
import { AnalyticsDrawer } from "@/components/AnalyticsDrawer";
import { TripDialog } from "@/components/TripDialog";
import { ChatWindow } from "@/components/ChatWindow";
import { MapVariant } from "@/lib/map-styles";
import { Language } from "@/lib/i18n";
import {
  CrashFeatureCollection,
  HotspotItem,
  MunicipalityItem,
} from "@/lib/schemas";

export default function Home() {
  const [lang, setLang] = useState<Language>("bg");
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [crashesData, setCrashesData] = useState<CrashFeatureCollection | null>(null);
  const [hotspotsData, setHotspotsData] = useState<HotspotItem[] | null>(null);

  const [selectedMuni, setSelectedMuni] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number | "">("");
  const [selectedDay, setSelectedDay] = useState<number | "">("");
  const [hourFrom, setHourFrom] = useState<number>(0);
  const [hourTo, setHourTo] = useState<number>(23);
  const [selectedType, setSelectedType] = useState<string>("");
  const [fatalOnly, setFatalOnly] = useState<boolean>(false);
  const [showHotspots, setShowHotspots] = useState<boolean>(false);

  const [mapVariant, setMapVariant] = useState<MapVariant>("white");
  const [layerMode, setLayerMode] = useState<"auto" | "heatmap" | "bubbles" | "both">("auto");
  const [dotSize, setDotSize] = useState<number>(5.5);
  const [dotOpacity, setDotOpacity] = useState<number>(0.85);
  const [heatmapIntensity, setHeatmapIntensity] = useState<number>(1.2);
  const [heatmapRadius, setHeatmapRadius] = useState<number>(24);
  const [fatalColor, setFatalColor] = useState<"red" | "amber" | "crimson">("red");

  const [llmBaseUrl, setLlmBaseUrl] = useState<string>("http://host.docker.internal:11434/v1");
  const [llmModel, setLlmModel] = useState<string>("qwen3.5:9b");
  const [maxPoints, setMaxPoints] = useState<number>(5000);

  const [selectedCrashId, setSelectedCrashId] = useState<number | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<[number, number] | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState<boolean>(false);
  const [isTripOpen, setIsTripOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [tripGeoJson, setTripGeoJson] = useState<any | null>(null);

  useEffect(() => {
    fetch("/api/municipalities")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setMunicipalities(data);
      })
      .catch(() => {});
  }, []);

  const loadCrashes = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedMuni) params.set("municipality", selectedMuni);
    if (selectedMonth !== "") params.set("month", String(selectedMonth));
    if (selectedDay !== "") params.set("day_of_week", String(selectedDay));
    if (hourFrom > 0) params.set("hour_from", String(hourFrom));
    if (hourTo < 23) params.set("hour_to", String(hourTo));
    if (selectedType) params.set("crash_type", selectedType);
    if (fatalOnly) params.set("fatal_only", "true");
    params.set("limit", String(maxPoints));

    fetch(`/api/crashes?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.features) setCrashesData(data);
      })
      .catch(() => {});
  }, [selectedMuni, selectedMonth, selectedDay, hourFrom, hourTo, selectedType, fatalOnly, maxPoints]);

  const loadHotspots = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedMuni) params.set("municipality", selectedMuni);
    if (selectedMonth !== "") params.set("month", String(selectedMonth));
    if (hourFrom > 0) params.set("hour_from", String(hourFrom));
    if (hourTo < 23) params.set("hour_to", String(hourTo));
    if (fatalOnly) params.set("fatal_only", "true");

    fetch(`/api/hotspots?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setHotspotsData(data);
      })
      .catch(() => {});
  }, [selectedMuni, selectedMonth, hourFrom, hourTo, fatalOnly]);

  useEffect(() => {
    loadCrashes();
    loadHotspots();
  }, [loadCrashes, loadHotspots]);

  const handleSelectMuni = (muni: string) => {
    setSelectedMuni(muni);
    if (!muni) {
      setFlyToLocation([42.7339, 25.4858]);
      return;
    }
    const found = municipalities.find((m) => m.municipality.toLowerCase() === muni.toLowerCase());
    if (found) {
      setFlyToLocation([found.center_lat, found.center_lon]);
    }
  };

  const handleClearFilters = () => {
    setSelectedMuni("");
    setSelectedMonth("");
    setSelectedDay("");
    setHourFrom(0);
    setHourTo(23);
    setSelectedType("");
    setFatalOnly(false);
  };

  return (
    <main className="w-screen h-screen overflow-hidden relative bg-dark-bg font-sans">
      <MapCanvas
        crashesData={crashesData}
        hotspotsData={hotspotsData}
        showHotspots={showHotspots}
        tripGeoJson={tripGeoJson}
        mapVariant={mapVariant}
        layerMode={layerMode}
        dotSize={dotSize}
        dotOpacity={dotOpacity}
        heatmapIntensity={heatmapIntensity}
        heatmapRadius={heatmapRadius}
        fatalColor={fatalColor}
        flyToLocation={flyToLocation}
        onSelectCrash={(id) => setSelectedCrashId(id)}
      />

      <FilterPanel
        lang={lang}
        municipalities={municipalities}
        selectedMuni={selectedMuni}
        onSelectMuni={handleSelectMuni}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        hourFrom={hourFrom}
        hourTo={hourTo}
        onHourChange={(from, to) => {
          setHourFrom(from);
          setHourTo(to);
        }}
        selectedType={selectedType}
        onSelectType={setSelectedType}
        fatalOnly={fatalOnly}
        onToggleFatal={setFatalOnly}
        showHotspots={showHotspots}
        onToggleHotspots={setShowHotspots}
        onClearFilters={handleClearFilters}
        visibleCount={crashesData?.features?.length || 0}
        onOpenAnalytics={() => setIsAnalyticsOpen(true)}
        onOpenTrip={() => setIsTripOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
      />

      <CustomisePanel
        lang={lang}
        mapVariant={mapVariant}
        onSelectMapVariant={setMapVariant}
        layerMode={layerMode}
        onSelectLayerMode={setLayerMode}
        dotSize={dotSize}
        onChangeDotSize={setDotSize}
        dotOpacity={dotOpacity}
        onChangeDotOpacity={setDotOpacity}
        heatmapIntensity={heatmapIntensity}
        onChangeHeatmapIntensity={setHeatmapIntensity}
        heatmapRadius={heatmapRadius}
        onChangeHeatmapRadius={setHeatmapRadius}
        fatalColor={fatalColor}
        onChangeFatalColor={setFatalColor}
      />

      <SettingsPanel
        lang={lang}
        onSelectLang={setLang}
        llmBaseUrl={llmBaseUrl}
        onChangeLlmBaseUrl={setLlmBaseUrl}
        llmModel={llmModel}
        onChangeLlmModel={setLlmModel}
        maxPoints={maxPoints}
        onChangeMaxPoints={setMaxPoints}
      />

      <CrashDetailCard
        crashId={selectedCrashId}
        onClose={() => setSelectedCrashId(null)}
        lang={lang}
      />

      <AnalyticsDrawer
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        lang={lang}
        municipalities={municipalities}
        selectedMuni={selectedMuni}
        onFlyToLocation={(loc) => setFlyToLocation(loc)}
      />

      <TripDialog
        isOpen={isTripOpen}
        onClose={() => setIsTripOpen(false)}
        lang={lang}
        onApplyRoute={(route) => setTripGeoJson(route)}
      />

      <ChatWindow
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        lang={lang}
        selectedMuni={selectedMuni}
        llmBaseUrl={llmBaseUrl}
        llmModel={llmModel}
      />
    </main>
  );
}
