"use client";

import { useEffect, useRef } from "react";
import type { FeatureCollection, Point as GeoPoint } from "geojson";
import { getVersion, Map as LibreMap, ScaleControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import type { Bounds, Crash, Severity } from "@/lib/crashes";
import { severities } from "@/lib/crashes";
import type { Language } from "@/lib/language";
import {
  type Basemap, type Country, type CrashView, type Imagery,
  clusterCircleLayer, countryBounds, emptyPoints, imageryLayer, imagerySource, mapPlaceName, mapStyle,
  pointLayers, pointSource, rasterSource, streetLayers, streetSource,
} from "@/lib/map-style";

export type MapNotice = "streetError" | "imageryError" | "pointsError";

export interface MapControls {
  zoom: (delta: number) => void;
  reset: () => void;
  bounds: () => Bounds;
  locate: (crash: Crash) => void;
}

interface MapSettings {
  basemap: Basemap;
  view: CrashView;
  language: Language;
  snapshotId: string | null;
  selected: Crash | null;
}

interface CanvasProps extends MapSettings {
  imageryKey: string | null;
  label: string;
  onReady: (map: MapControls | null) => void;
  onUnavailable: () => void;
  onImagery: (imagery: Imagery | null) => void;
  onNotice: (notice: MapNotice, show: boolean) => void;
  onPointsReady: (ready: boolean) => void;
  onCrash: (id: number) => void;
  onOverlap: (bounds: Bounds) => void;
}

const markerColors = { none: "#469bff", injury: "#ee4e5d", fatal: "#e64250", unknown: "#9ba4ae" };

function markerImage(severity: Severity) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 40;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not draw map markers.");
  context.scale(2, 2);
  const circle = (radius: number, color: string) => {
    context.beginPath();
    context.arc(10, 10, radius, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  };
  circle(7, "#15171b");
  circle(6, "#ffffff");
  circle(5, markerColors[severity]);
  if (severity === "injury") circle(3, markerColors.none);
  if (severity === "fatal") {
    context.fillStyle = "#ffffff";
    context.translate(10, 10);
    context.rotate(Math.PI / 4);
    context.fillRect(-1.55, -1.55, 3.1, 3.1);
  }
  if (severity === "unknown") {
    context.fillStyle = "#38434d";
    context.fillRect(7, 9.35, 6, 1.3);
  }
  return context.getImageData(0, 0, 40, 40);
}

function prefersStill() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function connectMap(
  map: LibreMap,
  bounds: Bounds,
  current: { current: CanvasProps },
  container: HTMLElement,
) {
  const [west, south, east, north] = bounds;
  const key = current.current.imageryKey;
  const imageryOptions: Imagery[] = key ? ["maptiler", "copernicus", "eox"] : ["copernicus", "eox"];
  let imageryIndex = 0;
  let isReady = false;
  let streetFailed = false;
  let previous: MapSettings | null = null;
  let pendingPoints = false;
  let timer: number | undefined;

  function reset() {
    const narrow = container.clientWidth < 620;
    map.fitBounds([[west, south], [east, north]], {
      padding: narrow
        ? { top: 128, right: 19, bottom: 104, left: 19 }
        : { top: 87, right: 65, bottom: 111, left: 65 },
      duration: prefersStill() || !isReady ? 0 : 540,
    });
  }

  function setLayer(id: string, visible: boolean) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }

  function activeImagery() {
    return imageryOptions[imageryIndex] ?? null;
  }

  function showImagery() {
    window.clearTimeout(timer);
    const satellite = current.current.basemap === "satellite";
    const active = satellite ? activeImagery() : null;
    if (active && !map.getSource(imagerySource(active))) {
      map.addSource(imagerySource(active), rasterSource(active, bounds, key));
      map.addLayer({
        id: imageryLayer(active), type: "raster", source: imagerySource(active),
        paint: { "raster-fade-duration": 150 },
      }, streetLayers[0]);
    }
    for (const imagery of imageryOptions) setLayer(imageryLayer(imagery), imagery === active);
    for (const layer of streetLayers) setLayer(layer, !satellite);
    current.current.onImagery(active);
    current.current.onNotice("streetError", !satellite && streetFailed);
    current.current.onNotice("imageryError", satellite && !active);

    if (active) {
      timer = window.setTimeout(() => {
        if (current.current.basemap === "satellite" && activeImagery() === active &&
            map.isSourceLoaded(imagerySource(active)) === false) {
          imageryIndex += 1;
          showImagery();
        }
      }, 12_000);
    }
  }

  function update(settings: MapSettings) {
    if (!isReady) return;
    const isLight = settings.basemap === "satellite";
    if (!previous || previous.basemap !== settings.basemap) {
      const ground = isLight ? "#ffffff" : "#111111";
      map.setPaintProperty("frame", "background-color", ground);
      map.setPaintProperty("country-mask", "fill-color", ground);
      map.setPaintProperty("country-ground", "fill-color", isLight ? "#e6e8e7" : "#232323");
      map.setPaintProperty("country-outline", "line-color", isLight ? "#5b625e" : "#575757");
      showImagery();
    }
    if (!previous || previous.view !== settings.view || previous.basemap !== settings.basemap) {
      const hotspots = settings.view === "hotspots";
      setLayer("hotspot-single", hotspots);
      setLayer("severity-points", !hotspots);
      map.setPaintProperty(clusterCircleLayer, "circle-color", hotspots ? "#ef4b58" : isLight ? "#222832" : "#8b919b");
      map.setPaintProperty(clusterCircleLayer, "circle-stroke-color", hotspots ? "#f97882" : isLight ? "#262a30" : "#c3c7ce");
      map.setPaintProperty("cluster-count", "text-halo-color", hotspots ? "#682630" : "#252832");
    }
    if (!previous || previous.language !== settings.language) {
      map.getCanvas().setAttribute("aria-label", current.current.label);
      for (const layer of ["road-text", "place-text"]) {
        map.setLayoutProperty(layer, "text-field", mapPlaceName(settings.language));
      }
    }
    if (!previous || previous.snapshotId !== settings.snapshotId) {
      pendingPoints = Boolean(settings.snapshotId);
      current.current.onPointsReady(false);
      current.current.onNotice("pointsError", false);
      const data = settings.snapshotId ? `/api/snapshots/${settings.snapshotId}/points.geojson` : emptyPoints;
      map.getSource<GeoJSONSource>(pointSource)?.setData(data);
    }
    if (!previous || previous.selected !== settings.selected) {
      const selected: FeatureCollection<GeoPoint> = { type: "FeatureCollection", features: [] };
      if (settings.selected) {
        const { longitude, latitude } = settings.selected;
        selected.features.push({
          type: "Feature", properties: {},
          geometry: { type: "Point", coordinates: [longitude, latitude] },
        });
      }
      map.getSource<GeoJSONSource>("selected-crash")?.setData(selected);
    }
    previous = settings;
  }

  map.on("error", (event) => {
    const source = event as typeof event & { sourceId?: string; source?: { id?: string } };
    const id = source.sourceId ?? source.source?.id;
    if (id === streetSource) {
      streetFailed = true;
      current.current.onNotice("streetError", current.current.basemap === "streets");
    }
    if (id === pointSource) {
      pendingPoints = false;
      current.current.onNotice("pointsError", true);
    }

    const active = activeImagery();
    if (active && id === imagerySource(active) && current.current.basemap === "satellite") {
      imageryIndex += 1;
      showImagery();
    }
  });

  map.on("idle", () => {
    if (pendingPoints && map.isSourceLoaded(pointSource)) {
      pendingPoints = false;
      current.current.onPointsReady(true);
    }
  });

  const controls: MapControls = {
    zoom(delta) {
      map.zoomTo(map.getZoom() + delta, { duration: prefersStill() ? 0 : 260 });
    },
    reset,
    bounds() {
      const viewport = map.getBounds();
      return [
        Math.max(-180, viewport.getWest()), Math.max(-90, viewport.getSouth()),
        Math.min(180, viewport.getEast()), Math.min(90, viewport.getNorth()),
      ];
    },
    locate(crash) {
      map.easeTo({
        center: [crash.longitude, crash.latitude], zoom: Math.max(16.25, map.getZoom()),
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        duration: prefersStill() ? 0 : 470,
      });
    },
  };

  map.once("style.load", () => {
    for (const severity of severities) map.addImage(`severity-${severity}`, markerImage(severity), { pixelRatio: 2 });
    map.setMaxBounds([[west - 8, south - 7], [east + 8, north + 7]]);
    reset();
    isReady = true;
    update(current.current);
    current.current.onReady(controls);
  });

  function hitLayers() {
    return [clusterCircleLayer, pointLayers[current.current.view === "hotspots" ? 0 : 1]];
  }

  function isOutside(event: MapMouseEvent) {
    return map.queryRenderedFeatures(event.point, { layers: ["country-mask"] }).length > 0;
  }

  map.on("mousemove", (event) => {
    if (!isReady) return;
    const isTarget = !isOutside(event) && map.queryRenderedFeatures(event.point, { layers: hitLayers() }).length > 0;
    map.getCanvas().style.cursor = isTarget ? "pointer" : "";
  });

  map.on("click", async (event: MapMouseEvent) => {
    if (!isReady || !current.current.snapshotId || isOutside(event)) return;
    const { x, y } = event.point;
    const features = map.queryRenderedFeatures([[x - 6, y - 6], [x + 6, y + 6]], { layers: hitLayers() });
    const cluster = features.find((feature) => feature.properties.cluster);
    if (cluster?.geometry.type === "Point") {
      const source = map.getSource<GeoJSONSource>(pointSource);
      try {
        const zoom = await source?.getClusterExpansionZoom(cluster.properties.cluster_id);
        if (zoom !== undefined && isReady) {
          map.easeTo({
            center: cluster.geometry.coordinates.slice(0, 2) as [number, number],
            zoom, duration: prefersStill() ? 0 : 480,
          });
        }
      } catch {
        // The point source can change while an expansion is being requested.
      }
      return;
    }

    const ids = new Set(features.map((feature) => Number(feature.properties.crashId)).filter(Number.isInteger));
    if (ids.size === 1) current.current.onCrash([...ids][0]);
    if (ids.size > 1) {
      const a = map.unproject([x - 14, y + 14]);
      const b = map.unproject([x + 14, y - 14]);
      current.current.onOverlap([a.lng, a.lat, b.lng, b.lat]);
    }
  });

  return {
    update,
    destroy() {
      isReady = false;
      window.clearTimeout(timer);
      map.remove();
    },
  };
}

export function MapCanvas(props: CanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  const controller = useRef<ReturnType<typeof connectMap> | null>(null);

  useEffect(() => {
    current.current = props;
    controller.current?.update(props);
  }, [props]);

  useEffect(() => {
    const wrapper = container.current;
    if (!wrapper) return;
    const abort = new AbortController();
    let disposed = false;

    async function start(element: HTMLDivElement) {
      try {
        const response = await fetch("/maps/bulgaria.geojson", { signal: abort.signal });
        if (!response.ok) throw new Error("The country boundary could not load.");
        const country = await response.json() as Country;
        if (disposed) return;
        const bounds = countryBounds(country);
        setWorkerUrl(`/maps/maplibre-gl-worker.mjs?v=${getVersion()}`);
        const map = new LibreMap({
          container: element,
          style: mapStyle(country, bounds),
          center: [25.1, 42.7],
          zoom: 5.4,
          minZoom: 4,
          maxZoom: 19,
          maxPitch: 0,
          dragRotate: false,
          touchPitch: false,
          renderWorldCopies: false,
          attributionControl: false,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new ScaleControl({ maxWidth: 92, unit: "metric" }), "bottom-right");
        map.on("webglcontextlost", () => {
          current.current.onReady(null);
          current.current.onUnavailable();
        });
        controller.current = connectMap(map, bounds, current, element);
      } catch {
        if (!disposed) current.current.onUnavailable();
      }
    }

    void start(wrapper);
    return () => {
      disposed = true;
      abort.abort();
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  return <div ref={container} className="map-canvas" role="region" aria-label={props.label} />;
}
