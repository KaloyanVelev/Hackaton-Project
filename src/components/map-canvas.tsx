"use client";

import { useEffect, useRef } from "react";
import type { FeatureCollection, LineString, Point as GeoPoint, Polygon } from "geojson";
import { getVersion, Map as LibreMap, ScaleControl, setWorkerUrl, type GeoJSONSource, type MapMouseEvent, type Point } from "maplibre-gl";
import type { Bounds, Crash, CrashFilters, Severity } from "@/lib/crashes";
import { severities } from "@/lib/crashes";
import { copy, type Language } from "@/lib/language";
import type { TripResult } from "@/lib/trip";
import {
  type Basemap, type Country, type CrashView, type Imagery,
  clusterCircleLayer, countryBounds, emptyPoints, heatmapLayer, hotspotSelection, imageryLayer, imagerySource,
  mapClusterCount, mapPlaceName, mapStyle, pointSource, rasterSource, reliefLayer, severityLayer, streetLayerPrefix, streetSource,
  tripSource,
} from "@/lib/map-style";

export type MapNotice = "streetError" | "imageryError" | "pointsError";

export interface MapControls {
  zoom: (delta: number) => void;
  zoomToArea: (bounds: Bounds) => void;
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
  selectedArea: Bounds | null;
  trip: TripResult | null;
  inspectCrashes: boolean;
  filters?: CrashFilters;
}

interface CanvasProps extends MapSettings {
  imageryKey: string | null;
  streetsStyle: string;
  label: string;
  onReady: (map: MapControls | null) => void;
  onUnavailable: () => void;
  onImagery: (imagery: Imagery | null) => void;
  onNotice: (notice: MapNotice, show: boolean) => void;
  onPointsReady: (ready: boolean) => void;
  onCrash: (id: number) => void;
  onHotspot: (bounds: Bounds) => void;
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
  let streetLayers: string[] = [];
  let previous: MapSettings | null = null;
  let pendingPoints = false;
  let timer: number | undefined;

  function reset() {
    const width = container.clientWidth;
    const padding = width < 621
      ? { top: container.clientHeight < 570 ? 105 : 128, right: 19, bottom: 140, left: 19 }
      : width < 1180
        ? { top: 182, right: 48, bottom: 104, left: 48 }
        : { top: 88, right: 66, bottom: 104, left: 418 };
    map.fitBounds([[west, south], [east, north]], {
      padding,
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
    container.setAttribute("aria-busy", "true");
    const satellite = current.current.basemap === "satellite";
    const active = satellite ? activeImagery() : null;
    if (active && !map.getSource(imagerySource(active))) {
      map.addSource(imagerySource(active), rasterSource(active, bounds, key));
      map.addLayer({
        id: imageryLayer(active), type: "raster", source: imagerySource(active),
        paint: { "raster-fade-duration": 150 },
      }, streetLayers[0] ?? reliefLayer);
    }
    for (const imagery of imageryOptions) setLayer(imageryLayer(imagery), imagery === active);
    for (const layer of streetLayers) setLayer(layer, !satellite);
    setLayer(reliefLayer, satellite);
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
      map.setPaintProperty("country-ground", "fill-color", isLight ? "#e5e7df" : "#ffffff");
      map.setPaintProperty("country-outline", "line-color", isLight ? "#5b625e" : "#717171");
      showImagery();
    }
    if (!previous || previous.view !== settings.view || Boolean(previous.trip) !== Boolean(settings.trip)) {
      const hotspots = settings.view === "hotspots";
      const showCrashData = !settings.trip;
      setLayer(heatmapLayer, hotspots && showCrashData);
      setLayer(clusterCircleLayer, !hotspots && showCrashData);
      setLayer("cluster-count", !hotspots && showCrashData);
      setLayer(severityLayer, !hotspots && showCrashData);
      const points = map.getSource<GeoJSONSource>(pointSource);
      if (points && Boolean(points.getClusterOptions().cluster) !== !hotspots) {
        void points.setClusterOptions({ cluster: !hotspots });
      }
    }
    if (!previous || previous.language !== settings.language) {
      map.getCanvas().setAttribute("aria-label", current.current.label);
      map.setLayoutProperty("osm-place-text", "text-field", mapPlaceName(settings.language));
      map.setLayoutProperty("cluster-count", "text-field", mapClusterCount(settings.language));
    }
    if (!previous || previous.language !== settings.language || previous.view !== settings.view ||
        previous.inspectCrashes !== settings.inspectCrashes) {
      const canvas = map.getCanvas();
      if (settings.view === "hotspots" && settings.inspectCrashes) {
        canvas.setAttribute("aria-keyshortcuts", "Enter");
        canvas.setAttribute("aria-description", copy[settings.language].hotspotKeyboard);
      } else {
        canvas.removeAttribute("aria-keyshortcuts");
        canvas.removeAttribute("aria-description");
      }
    }
    if (!previous || previous.snapshotId !== settings.snapshotId) {
      pendingPoints = Boolean(settings.snapshotId);
      current.current.onPointsReady(false);
      current.current.onNotice("pointsError", false);
      const data = settings.snapshotId ? `/api/snapshots/${settings.snapshotId}/points.geojson` : emptyPoints;
      map.getSource<GeoJSONSource>(pointSource)?.setData(data);
    }
    if (!previous || previous.selectedArea !== settings.selectedArea) {
      const area: FeatureCollection<Polygon> = { type: "FeatureCollection", features: [] };
      if (settings.selectedArea) {
        const [left, bottom, right, top] = settings.selectedArea;
        area.features.push({
          type: "Feature", properties: {},
          geometry: { type: "Polygon", coordinates: [[[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]]] },
        });
      }
      map.getSource<GeoJSONSource>(hotspotSelection)?.setData(area);
    }
    if (!previous || previous.trip !== settings.trip) {
      const features: FeatureCollection<LineString | GeoPoint> = { type: "FeatureCollection", features: [] };
      if (settings.trip) {
        const { route, points } = settings.trip;
        features.features.push({ type: "Feature", geometry: route, properties: {} });
        features.features.push(...points.map(({ longitude, latitude, number }) => ({
          type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [longitude, latitude] },
          properties: { number },
        })));
        const [left, bottom, right, top] = route.coordinates.reduce<Bounds>(
          ([w, s, e, n], [lng, lat]) => [Math.min(w, lng), Math.min(s, lat), Math.max(e, lng), Math.max(n, lat)],
          [180, 90, -180, -90],
        );
        const width = container.clientWidth;
        const height = container.clientHeight;
        const narrow = width < 621;
        map.fitBounds([[left, bottom], [right, top]], {
          padding: {
            top: narrow ? 20 : 65,
            left: width >= 1180 ? 402 : 34,
            right: narrow ? 34 : Math.min(462, Math.round(width * 0.68)),
            bottom: narrow ? Math.min(Math.round(height * 0.72) + 10, height - 64) : 60,
          },
          maxZoom: 13,
          duration: prefersStill() ? 0 : 550,
        });
      }
      map.getSource<GeoJSONSource>(tripSource)?.setData(features);
    }
    if (!previous || previous.filters?.severity !== settings.filters?.severity) {
      const severityFilter = settings.filters?.severity;
      const baseFilter: unknown[] = ["!", ["has", "point_count"]];
      const activeFilter = severityFilter
        ? ["all", baseFilter, ["==", ["get", "severity"], severityFilter]]
        : baseFilter;
      if (map.getLayer(severityLayer)) {
        map.setFilter(severityLayer, activeFilter as any);
      }
      if (map.getLayer(heatmapLayer)) {
        map.setFilter(heatmapLayer, activeFilter as any);
      }
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

  map.on("movestart", () => container.setAttribute("aria-busy", "true"));
  map.on("idle", () => {
    container.setAttribute("aria-busy", "false");
    if (pendingPoints && map.isSourceLoaded(pointSource)) {
      pendingPoints = false;
      current.current.onPointsReady(true);
    }
  });

  const controls: MapControls = {
    zoom(delta) {
      map.zoomTo(map.getZoom() + delta, { duration: prefersStill() ? 0 : 260 });
    },
    zoomToArea([left, bottom, right, top]) {
      const width = container.clientWidth;
      map.fitBounds([[left, bottom], [right, top]], {
        padding: { top: width < 621 ? 125 : 30, bottom: 76, left: 26, right: width < 621 ? 26 : 405 },
        maxZoom: 17,
        duration: prefersStill() ? 0 : 430,
      });
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
    streetLayers = map.getStyle().layers.filter(({ id }) => id.startsWith(streetLayerPrefix)).map(({ id }) => id);
    for (const severity of severities) map.addImage(`severity-${severity}`, markerImage(severity), { pixelRatio: 2 });
    map.setMaxBounds([[west - 8, south - 7], [east + 8, north + 7]]);
    reset();
    isReady = true;
    update(current.current);
    current.current.onReady(controls);
  });

  const crashHitLayers = [clusterCircleLayer, severityLayer];

  function canSelectArea(point: Point) {
    return map.queryRenderedFeatures(point, { layers: ["country-ground"] }).length > 0;
  }

  function selectArea(point: Point) {
    const radius = 34;
    const a = map.unproject([point.x - radius, point.y + radius]);
    const b = map.unproject([point.x + radius, point.y - radius]);
    if (current.current.snapshotId) current.current.onHotspot([a.lng, a.lat, b.lng, b.lat]);
  }

  function onCanvasKey(event: KeyboardEvent) {
    if (!isReady || !current.current.inspectCrashes || event.key !== "Enter" || current.current.view !== "hotspots") return;
    const point = map.project(map.getCenter());
    if (canSelectArea(point)) {
      event.preventDefault();
      selectArea(point);
    }
  }

  map.getCanvas().addEventListener("keydown", onCanvasKey);
  map.on("mousemove", (event) => {
    if (!isReady) return;
    if (!current.current.inspectCrashes) {
      map.getCanvas().style.cursor = "";
      return;
    }
    const cursor = current.current.view === "hotspots"
      ? (current.current.snapshotId && canSelectArea(event.point) ? "crosshair" : "")
      : (map.queryRenderedFeatures(event.point, { layers: crashHitLayers }).length ? "pointer" : "");
    map.getCanvas().style.cursor = cursor;
  });

  map.on("click", async (event: MapMouseEvent) => {
    if (!isReady || !current.current.inspectCrashes || !current.current.snapshotId) return;
    if (current.current.view === "hotspots") {
      if (canSelectArea(event.point)) selectArea(event.point);
      return;
    }
    const { x, y } = event.point;
    const features = map.queryRenderedFeatures([[x - 6, y - 6], [x + 6, y + 6]], { layers: crashHitLayers });
    const cluster = features.find((feature) => feature.properties.cluster);
    if (cluster?.geometry.type === "Point") {
      const source = map.getSource<GeoJSONSource>(pointSource);
      try {
        const zoom = await source?.getClusterExpansionZoom(cluster.properties.cluster_id);
        if (zoom !== undefined && isReady && current.current.view === "crashes") {
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
      map.getCanvas().removeEventListener("keydown", onCanvasKey);
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
        const [response, street] = await Promise.all([
          fetch("/maps/bulgaria.geojson", { signal: abort.signal }),
          fetch(current.current.streetsStyle, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(4_500)]) })
            .then(async (metadata): Promise<unknown> => metadata.ok ? await metadata.json() : null)
            .catch(() => null),
        ]);
        if (!response.ok) throw new Error("The country boundary could not load.");
        const country = await response.json() as Country;
        if (disposed) return;
        const bounds = countryBounds(country);
        setWorkerUrl(`/maps/maplibre-gl-worker.mjs?v=${getVersion()}`);
        const map = new LibreMap({
          container: element,
          style: mapStyle(country, bounds, street),
          center: [25.1, 42.7],
          zoom: 5.4,
          minZoom: 4,
          maxZoom: 19,
          canvasContextAttributes: { antialias: true },
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
