import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { ExpressionSpecification, LayerSpecification, RasterSourceSpecification, StyleSpecification } from "maplibre-gl";
import type { Bounds, CrashPoints } from "./crashes";
import type { Language } from "./language";

export type Country = FeatureCollection<Polygon | MultiPolygon>;
export type Basemap = "streets" | "satellite";
export type CrashView = "hotspots" | "crashes";
export type Imagery = "maptiler" | "copernicus" | "eox";

export const pointSource = "crash-points";
export const clusterCircleLayer = "crash-clusters";
export const pointLayers = ["hotspot-single", "severity-points"];
export const streetSource = "street-tiles";
export const streetLayers = ["landcover", "parks", "water", "building", "road-local", "road-major", "place-text", "road-text"];
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
const largeRoads = ["motorway", "trunk", "primary", "secondary"];
export function mapPlaceName(language: Language): ExpressionSpecification {
  const fields = language === "bg" ? ["name:bg", "name"] : ["name:en", "name_en", "name:latin", "name"];
  return ["coalesce", ...fields.map((field): ["get", string] => ["get", field]), ""];
}

const streets: LayerSpecification[] = [
  {
    id: "landcover", type: "fill", source: streetSource, "source-layer": "landcover",
    paint: {
      "fill-color": ["match", ["get", "class"], "wood", "#303030", "ice", "#3b3b3b", "#252525"],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.44, 11, 0.64],
      "fill-antialias": false,
    },
  },
  {
    id: "parks", type: "fill", source: streetSource, "source-layer": "park", minzoom: 9,
    paint: { "fill-color": "#2e2e2e", "fill-opacity": 0.58, "fill-antialias": false },
  },
  {
    id: "water", type: "fill", source: streetSource, "source-layer": "water",
    paint: { "fill-color": "#171717", "fill-outline-color": "#383838" },
  },
  {
    id: "building", type: "fill", source: streetSource, "source-layer": "building", minzoom: 13,
    paint: { "fill-color": "#3d3d3d", "fill-outline-color": "#4b4b4b" },
  },
  {
    id: "road-local", type: "line", source: streetSource, "source-layer": "transportation", minzoom: 9,
    filter: ["!", ["in", ["get", "class"], ["literal", [...largeRoads, "rail", "transit", "ferry"]]]],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#595959",
      "line-width": ["interpolate", ["exponential", 1.38], ["zoom"], 9, 0.35, 13, 1.1, 18, 4.8],
    },
  },
  {
    id: "road-major", type: "line", source: streetSource, "source-layer": "transportation",
    filter: ["in", ["get", "class"], ["literal", largeRoads]],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": ["match", ["get", "class"], ["motorway", "trunk"], "#929292", "#666666"],
      "line-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.48, 11, 0.86],
      "line-width": ["interpolate", ["exponential", 1.32], ["zoom"], 5, 0.5, 9, 1.15, 13, 2.2, 17, 5.9],
    },
  },
  {
    id: "place-text", type: "symbol", source: streetSource, "source-layer": "place", minzoom: 5,
    filter: ["step", ["zoom"], ["match", ["get", "class"], ["city", "town"], true, false], 10,
      ["match", ["get", "class"], ["city", "town", "village", "suburb"], true, false]],
    layout: {
      "text-field": mapPlaceName("bg"),
      "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 11, 13, 15, 15],
      "text-font": font,
      "text-padding": 6,
      "symbol-sort-key": ["coalesce", ["get", "rank"], 50],
    },
    paint: { "text-color": "#d0d0d0", "text-halo-color": "#1b1b1b", "text-halo-width": 1.15 },
  },
  {
    id: "road-text", type: "symbol", source: streetSource, "source-layer": "transportation_name", minzoom: 13,
    layout: {
      "text-field": mapPlaceName("bg"),
      "text-font": font,
      "text-size": 11,
      "symbol-placement": "line",
      "text-max-angle": 35,
    },
    paint: { "text-color": "#bdbdbd", "text-halo-color": "#202020", "text-halo-width": 1.15 },
  },
];

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

export function mapStyle(country: Country, bounds: Bounds): StyleSpecification {
  return {
    version: 8,
    sources: {
      country: { type: "geojson", data: country, tolerance: 0 },
      "outside-country": { type: "geojson", data: countryMask(country), tolerance: 0 },
      [streetSource]: { type: "vector", url: "https://tiles.openfreemap.org/planet", bounds },
      [pointSource]: {
        type: "geojson",
        data: emptyPoints,
        cluster: true,
        clusterRadius: 44,
        clusterMaxZoom: 15,
        maxzoom: 18,
      },
      "selected-crash": { type: "geojson", data: emptyPoints },
    },
    layers: [
      { id: "frame", type: "background", paint: { "background-color": "#111111" } },
      { id: "country-ground", type: "fill", source: "country", paint: { "fill-color": "#232323" } },
      ...streets,
      {
        id: "hotspot-single", type: "circle", source: pointSource, filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 2.5, "circle-color": "#ed5360", "circle-opacity": 0.57 },
      },
      {
        id: clusterCircleLayer, type: "circle", source: pointSource, filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["sqrt", ["get", "point_count"]], 1, 10, 10, 14, 27, 21, 55, 28, 85, 34, 155, 44],
          "circle-color": "#ef4b58",
          "circle-opacity": 0.57,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#f97882",
          "circle-stroke-opacity": 0.7,
        },
      },
      {
        id: "cluster-count", type: "symbol", source: pointSource, filter: ["has", "point_count"],
        layout: {
          "text-field": ["to-string", ["get", "point_count"]],
          "text-font": font,
          "text-size": ["step", ["get", "point_count"], 10, 60, 11, 300, 12, 1200, 13],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "#58232a", "text-halo-width": 0.8 },
      },
      {
        id: "severity-points", type: "symbol", source: pointSource, filter: ["!", ["has", "point_count"]],
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
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      },
      { id: "country-mask", type: "fill", source: "outside-country", paint: { "fill-color": "#111111" } },
      { id: "country-outline", type: "line", source: "country", paint: { "line-color": "#575757", "line-width": 1.15 } },
    ],
  };
}
