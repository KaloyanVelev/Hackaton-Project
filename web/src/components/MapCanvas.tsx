"use client";

import React, { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import { MAP_STYLES, MapVariant } from "@/lib/map-styles";
import { CrashFeatureCollection, HotspotItem } from "@/lib/schemas";

interface MapCanvasProps {
  crashesData: CrashFeatureCollection | null;
  hotspotsData: HotspotItem[] | null;
  showHotspots: boolean;
  tripGeoJson: any | null;
  mapVariant: MapVariant;
  layerMode: "auto" | "heatmap" | "bubbles" | "both";
  dotSize: number;
  dotOpacity: number;
  heatmapIntensity: number;
  heatmapRadius: number;
  fatalColor: "red" | "amber" | "crimson";
  flyToLocation: [number, number] | null;
  onSelectCrash: (id: number) => void;
}

export function MapCanvas({
  crashesData,
  hotspotsData,
  showHotspots,
  tripGeoJson,
  mapVariant,
  layerMode,
  dotSize,
  dotOpacity,
  heatmapIntensity,
  heatmapRadius,
  fatalColor,
  flyToLocation,
  onSelectCrash,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleLoadedRef = useRef<boolean>(false);

  const getFatalHex = () => {
    if (fatalColor === "amber") return "#F59E0B";
    if (fatalColor === "crimson") return "#BE123C";
    return "#EF4444";
  };

  const setupSourcesAndLayers = (map: MapLibreMap) => {
    if (!map.getSource("crashes-source")) {
      map.addSource("crashes-source", {
        type: "geojson",
        data: crashesData || { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getSource("hotspots-source")) {
      const hotspotFeatures = (hotspotsData || []).map((h, i) => ({
        type: "Feature",
        id: i,
        geometry: { type: "Point", coordinates: [h.center_lon, h.center_lat] },
        properties: h,
      }));
      map.addSource("hotspots-source", {
        type: "geojson",
        data: { type: "FeatureCollection", features: hotspotFeatures as any },
      });
    }

    if (!map.getSource("trip-source")) {
      map.addSource("trip-source", {
        type: "geojson",
        data: tripGeoJson ? { type: "Feature", geometry: tripGeoJson, properties: {} } : { type: "FeatureCollection", features: [] },
      });
    }

    if (!map.getLayer("crash-heatmap")) {
      map.addLayer({
        id: "crash-heatmap",
        type: "heatmap",
        source: "crashes-source",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "killed"], 0, 0.5, 1, 1.5, 3, 3.0],
          "heatmap-intensity": heatmapIntensity,
          "heatmap-radius": heatmapRadius,
          "heatmap-opacity": layerMode === "bubbles" ? 0 : 0.85,
        },
      });
    }

    if (!map.getLayer("hotspots-layer")) {
      map.addLayer({
        id: "hotspots-layer",
        type: "circle",
        source: "hotspots-source",
        layout: {
          visibility: showHotspots ? "visible" : "none",
        },
        paint: {
          "circle-radius": 22,
          "circle-color": "rgba(245, 158, 11, 0.22)",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#F59E0B",
          "circle-stroke-opacity": 0.85,
        },
      });
    }

    if (!map.getLayer("trip-route-layer")) {
      map.addLayer({
        id: "trip-route-layer",
        type: "line",
        source: "trip-source",
        paint: {
          "line-color": "#10B981",
          "line-width": 4.5,
          "line-opacity": 0.9,
        },
      });
    }

    if (!map.getLayer("crash-circles")) {
      map.addLayer({
        id: "crash-circles",
        type: "circle",
        source: "crashes-source",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7, Math.max(1.5, dotSize * 0.4),
            11, dotSize,
            15, dotSize * 1.8,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "is_fatal"], true],
            getFatalHex(),
            "#0284C7"
          ],
          "circle-opacity": layerMode === "heatmap" ? 0 : dotOpacity,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-opacity": layerMode === "heatmap" ? 0 : 0.7,
        },
      });

      map.on("click", "crash-circles", (e) => {
        if (e.features && e.features.length > 0) {
          const id = e.features[0].properties?.id;
          if (id) {
            onSelectCrash(Number(id));
          }
        }
      });

      map.on("mouseenter", "crash-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "crash-circles", () => {
        map.getCanvas().style.cursor = "";
      });
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES[mapVariant],
      center: [25.4858, 42.7339],
      zoom: 6.8,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      styleLoadedRef.current = true;
      setupSourcesAndLayers(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    styleLoadedRef.current = false;
    map.setStyle(MAP_STYLES[mapVariant]);

    const onStyleLoad = () => {
      styleLoadedRef.current = true;
      setupSourcesAndLayers(map);
    };

    map.once("style.load", onStyleLoad);
  }, [mapVariant]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    const source = map.getSource("crashes-source") as maplibregl.GeoJSONSource | undefined;
    if (source && crashesData) {
      source.setData(crashesData);
    }
  }, [crashesData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    const source = map.getSource("hotspots-source") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      const hotspotFeatures = (hotspotsData || []).map((h, i) => ({
        type: "Feature",
        id: i,
        geometry: { type: "Point", coordinates: [h.center_lon, h.center_lat] },
        properties: h,
      }));
      source.setData({ type: "FeatureCollection", features: hotspotFeatures as any });
    }

    if (map.getLayer("hotspots-layer")) {
      map.setLayoutProperty("hotspots-layer", "visibility", showHotspots ? "visible" : "none");
    }
  }, [hotspotsData, showHotspots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    const source = map.getSource("trip-source") as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(
        tripGeoJson
          ? { type: "Feature", geometry: tripGeoJson, properties: {} }
          : { type: "FeatureCollection", features: [] }
      );
    }
  }, [tripGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoadedRef.current) return;

    if (map.getLayer("crash-circles")) {
      map.setPaintProperty("crash-circles", "circle-radius", [
        "interpolate",
        ["linear"],
        ["zoom"],
        7, Math.max(1.5, dotSize * 0.4),
        11, dotSize,
        15, dotSize * 1.8,
      ]);
      map.setPaintProperty("crash-circles", "circle-opacity", layerMode === "heatmap" ? 0 : dotOpacity);
      map.setPaintProperty("crash-circles", "circle-stroke-opacity", layerMode === "heatmap" ? 0 : 0.7);
      map.setPaintProperty("crash-circles", "circle-color", [
        "case",
        ["==", ["get", "is_fatal"], true],
        getFatalHex(),
        "#0284C7"
      ]);
    }

    if (map.getLayer("crash-heatmap")) {
      map.setPaintProperty("crash-heatmap", "heatmap-intensity", heatmapIntensity);
      map.setPaintProperty("crash-heatmap", "heatmap-radius", heatmapRadius);
      map.setPaintProperty("crash-heatmap", "heatmap-opacity", layerMode === "bubbles" ? 0 : 0.85);
    }
  }, [dotSize, dotOpacity, heatmapIntensity, heatmapRadius, fatalColor, layerMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToLocation) return;
    map.flyTo({
      center: [flyToLocation[1], flyToLocation[0]],
      zoom: 12.5,
      essential: true,
      speed: 1.2,
    });
  }, [flyToLocation]);

  return <div ref={containerRef} className="w-full h-screen relative" />;
}
