import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { ExpressionSpecification, LayerSpecification, RasterSourceSpecification, StyleSpecification, VectorSourceSpecification } from "maplibre-gl";
import type { Bounds, CrashPoints } from "./crashes";
import type { Language } from "./language";

export type Country = FeatureCollection<Polygon | MultiPolygon>;
export type Basemap = "streets" | "satellite";
export type CrashView = "hotspots" | "crashes";
export type Imagery = "maptiler" | "copernicus" | "eox";

export const pointSource = "crash-points";
export const heatmapLayer = "crash-density";
export const hotspotSelection = "hotspot-selection";
export const tripSource = "trip-route";
export const clusterCircleLayer = "crash-clusters";
export const severityLayer = "severity-points";
export const streetSource = "street-tiles";
export const streetStyleUrl = "https://vector.openstreetmap.org/styles/shortbread/graybeard.json";
export const streetLayerPrefix = "osm-";
export const reliefLayer = "terrain-relief";
export const imagerySource = (imagery: Imagery) => `imagery-${imagery}`;
export const imageryLayer = (imagery: Imagery) => `satellite-${imagery}`;
export const emptyPoints: CrashPoints = { type: "FeatureCollection", features: [] };

export function countryBounds(country: Country): Bounds {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const polygon of polygonsFrom(country)) {
    for (const [longitude, latitude] of polygon[0]) {
      west = Math.min(west, longitude);
      south = Math.min(south, latitude);
      east = Math.max(east, longitude);
      north = Math.max(north, latitude);
    }
  }
  return [west, south, east, north];
}

function polygonsFrom(country: Country): Position[][][] {
  return country.features.flatMap(({ geometry }) =>
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates,
  );
}

function orientRing(ring: Position[], counterClockwise: boolean) {
  const signedArea = ring.slice(0, -1).reduce((area, [x, y], i) => {
    const [nextX, nextY] = ring[i + 1];
    return area + x * nextY - y * nextX;
  }, 0);
  return (signedArea > 0) === counterClockwise ? ring : [...ring].reverse();
}

function countryMask(country: Country): Feature<MultiPolygon> {
  // The frame surrounds the padded camera bounds at every supported zoom.
  const frame = [[-45, 10], [90, 10], [90, 72], [-45, 72], [-45, 10]];
  const polygons = polygonsFrom(country);
  const outline = [frame, ...polygons.map(([shell]) => orientRing(shell, false))];
  const holes = polygons.flatMap(([, ...rings]) => rings.map((ring) => [orientRing(ring, true)]));
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiPolygon", coordinates: [outline, ...holes] },
  };
}

const font = ["sans-serif"];
const neutralHighlight = "#ffffff";

export function mapPlaceName(language: Language): ExpressionSpecification {
  const fields = language === "bg" ? ["name_bg", "name"] : ["name_en", "name"];
  return ["coalesce", ...fields.map((field): ["get", string] => ["get", field]), ""];
}

export function mapClusterCount(language: Language): ExpressionSpecification {
  return ["number-format", ["get", "point_count"], { locale: language === "bg" ? "bg-BG" : "en-GB" }];
}

function osmStyle(upstream: StyleSpecification | null, bounds: Bounds) {
  const entry = upstream && Object.entries(upstream.sources).find(([, source]) => source.type === "vector");
  const fallback: VectorSourceSpecification = {
    type: "vector", url: "https://vector.openstreetmap.org/shortbread_v1/tilejson.json", bounds,
  };
  if (!entry || !upstream) {
    const layers: LayerSpecification[] = [
      { id: "osm-water", type: "fill", source: streetSource, "source-layer": "water_polygons", paint: { "fill-color": "#dedfe0" } },
      {
        id: "osm-roads", type: "line", source: streetSource, "source-layer": "streets",
        paint: {
          "line-color": ["match", ["get", "kind"], ["motorway", "trunk", "primary"], "#86888c", "#acafb2"],
          "line-width": ["interpolate", ["exponential", 1.2], ["zoom"], 5, 0.6, 10, 1.15, 17, 5],
        },
      },
    ];
    return { source: fallback, layers, sprite: undefined };
  }

  const [sourceId, source] = entry;
  const layers = upstream.layers.flatMap((layer): LayerSpecification[] => {
    if (!("source" in layer) || layer.source !== sourceId || layer.layout?.visibility === "none") return [];
    if (layer.type === "symbol" && (layer["source-layer"] === "place_labels" || layer["source-layer"] === "boundary_labels")) return [];
    const id = streetLayerPrefix + layer.id;
    if (layer.type === "symbol") {
      // Local glyphs keep the labels and crash counts sharp and available during tile outages.
      return [{ ...layer, id, source: streetSource, layout: { ...layer.layout, "text-font": font } }];
    }
    return [{ ...layer, id, source: streetSource }];
  });
  return { source: { ...(source as VectorSourceSpecification), bounds }, layers, sprite: upstream.sprite };
}

function countryPlaceNames(country: Country): LayerSpecification {
  return {
    id: "osm-place-text", type: "symbol", source: streetSource, "source-layer": "place_labels", minzoom: 5,
    filter: ["all", ["within", country], ["step", ["zoom"],
      ["match", ["get", "kind"], ["city", "town"], true, false], 10,
      ["match", ["get", "kind"], ["city", "town", "village", "suburb"], true, false]]],
    layout: {
      "text-field": mapPlaceName("bg"),
      "text-font": font,
      "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 10, 12, 15, 15],
      "text-padding": 5,
      "symbol-sort-key": ["-", ["coalesce", ["to-number", ["get", "population"]], 0]],
    },
    paint: { "text-color": "#4b4e54", "text-halo-color": neutralHighlight, "text-halo-width": 1.2 },
  };
}

export function rasterSource(imagery: Imagery, bounds: Bounds, key: string | null): RasterSourceSpecification {
  if (imagery === "maptiler") {
    return {
      type: "raster",
      url: `https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=${encodeURIComponent(key ?? "")}`,
      bounds,
      tileSize: 512,
    };
  }
  if (imagery === "copernicus") {
    return {
      type: "raster",
      tiles: [
        "https://copernicus.discomap.eea.europa.eu/arcgis/services/GioLand/VHR_2021_LAEA/ImageServer/WMSServer"
        + "?service=WMS&version=1.3.0&request=GetMap&layers=0&styles=&crs=EPSG:3857"
        + "&bbox={bbox-epsg-3857}&width=256&height=256&format=image%2Fjpeg",
      ],
      bounds,
      maxzoom: 16,
      tileSize: 256,
    };
  }
  return {
    type: "raster",
    tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"],
    bounds,
    maxzoom: 14,
    tileSize: 256,
  };
}

function combineMapStyle(country: Country, bounds: Bounds, street: StyleSpecification | null): StyleSpecification {
  const official = osmStyle(street, bounds);
  return {
    version: 8,
    sprite: official.sprite,
    sources: {
      country: { type: "geojson", data: country, tolerance: 0 },
      "outside-country": { type: "geojson", data: countryMask(country), tolerance: 0 },
      [streetSource]: official.source,
      "elevation": {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 14,
        bounds,
      },
      [pointSource]: {
        type: "geojson",
        data: emptyPoints,
        cluster: false,
        clusterRadius: 44,
        clusterMaxZoom: 15,
        maxzoom: 18,
      },
      [hotspotSelection]: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      "selected-crash": { type: "geojson", data: emptyPoints },
      [tripSource]: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    },
    layers: [
      { id: "frame", type: "background", paint: { "background-color": "#111111" } },
      { id: "country-ground", type: "fill", source: "country", paint: { "fill-color": "#ffffff" } },
      ...official.layers,
      {
        id: "osm-national-roads", type: "line", source: streetSource, "source-layer": "streets", minzoom: 5, maxzoom: 8,
        filter: ["in", ["get", "kind"], ["literal", ["motorway", "trunk", "primary"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#777b80",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.45, 6.8, 0.56, 8, 0],
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.53, 7.5, 1.1],
        },
      },
      {
        id: reliefLayer, type: "hillshade", source: "elevation", layout: { visibility: "none" },
        paint: {
          "hillshade-method": "combined",
          "hillshade-exaggeration": 0.66,
          "hillshade-illumination-direction": 315,
          "hillshade-shadow-color": "#272c28",
          "hillshade-accent-color": "#303a32",
          "hillshade-highlight-color": "#f6f3e8",
        },
      },
      {
        id: heatmapLayer, type: "heatmap", source: pointSource, filter: ["!", ["has", "point_count"]],
        paint: {
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 13, 8, 20, 13, 25, 18, 33],
          "heatmap-intensity": ["interpolate", ["exponential", 1.35], ["zoom"], 4, 0.0017, 7, 0.0037, 10, 0.022, 13, 0.18, 18, 0.95],
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(42,101,220,0)", 0.06, "rgba(42,101,220,0.25)", 0.18, "#4289de",
            0.31, "#45d2cf", 0.49, "#f5d65a", 0.68, "#f78f4c", 0.85, "#ef4f65", 1, "#b72458"],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.73, 11, 0.86],
        },
      },
      {
        id: "hotspot-outline-halo", type: "line", source: hotspotSelection,
        paint: { "line-color": "#ffffff", "line-opacity": 0.92, "line-width": 4 },
      },
      {
        id: "hotspot-outline", type: "line", source: hotspotSelection,
        paint: { "line-color": "#262433", "line-width": 1.8, "line-dasharray": [2.4, 1.5] },
      },
      { id: "country-mask", type: "fill", source: "outside-country", paint: { "fill-color": "#111111" } },
      { id: "country-outline", type: "line", source: "country", paint: { "line-color": "#717171", "line-width": 1.05 } },
      countryPlaceNames(country),
      {
        id: clusterCircleLayer, type: "circle", source: pointSource, filter: ["has", "point_count"],
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "point_count"]], 1, 10, 10, 13, 27, 19, 55, 24, 85, 29, 155, 39],
          "circle-color": "#303842",
          "circle-opacity": 0.67,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#777e87",
          "circle-stroke-opacity": 0.7,
        },
      },
      {
        id: "cluster-count", type: "symbol", source: pointSource, filter: ["has", "point_count"],
        layout: {
          visibility: "none",
          "text-field": mapClusterCount("bg"),
          "text-font": font,
          "text-size": ["step", ["get", "point_count"], 10, 60, 11, 300, 12, 1200, 13],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "#252832", "text-halo-width": 0.8 },
      },
      {
        id: severityLayer, type: "symbol", source: pointSource, filter: ["!", ["has", "point_count"]],
        layout: {
          visibility: "none",
          "icon-image": ["concat", "severity-", ["get", "severity"]],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      },
      {
        id: "selected-point", type: "circle", source: "selected-crash",
        paint: {
          "circle-radius": 11,
          "circle-color": "transparent",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#7945c7",
        },
      },
      {
        id: "trip-route-halo", type: "line", source: tripSource, filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.93 },
      },
      {
        id: "trip-route-line", type: "line", source: tripSource, filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#5f35bf", "line-width": 4.5 },
      },
      {
        id: "trip-samples", type: "circle", source: tripSource, filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": "#3b207b", "circle-radius": 10, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
        },
      },
      {
        id: "trip-sample-numbers", type: "symbol", source: tripSource, filter: ["==", ["geometry-type"], "Point"],
        layout: {
          "text-field": ["to-string", ["get", "number"]],
          "text-font": font, "text-size": 10, "text-allow-overlap": true, "text-ignore-placement": true,
        },
        paint: { "text-color": "#ffffff" },
      },
    ],
  };
}

function isStreetStyle(value: unknown): value is StyleSpecification {
  if (value === null || typeof value !== "object") return false;
  const { version, sources, layers } = value as Partial<StyleSpecification>;
  return version === 8 && sources !== null && typeof sources === "object" && !Array.isArray(sources) &&
    Object.values(sources).every((source) => source !== null && typeof source === "object" && "type" in source) &&
    Array.isArray(layers) && layers.every((layer) =>
      layer !== null && typeof layer === "object" && typeof layer.id === "string" && typeof layer.type === "string");
}

export function mapStyle(country: Country, bounds: Bounds, street: unknown): StyleSpecification {
  if (isStreetStyle(street)) {
    try {
      const combined = combineMapStyle(country, bounds, street);
      if (validateStyleMin(combined).length === 0) return combined;
    } catch {
      // Fall back if a hosted style uses a construct the installed renderer cannot parse.
    }
  }
  return combineMapStyle(country, bounds, null);
}
