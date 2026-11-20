import type { StyleSpecification } from "maplibre-gl";

export type MapVariant = "white" | "dark" | "geo" | "satellite";

export const TOPO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "opentopomap": {
      type: "raster",
      tiles: [
        "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
        "https://c.tile.opentopomap.org/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap"
    }
  },
  layers: [
    {
      id: "opentopomap-layer",
      type: "raster",
      source: "opentopomap",
      minzoom: 0,
      maxzoom: 18
    }
  ]
};

export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "esri-satellite": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
    }
  },
  layers: [
    {
      id: "esri-satellite-layer",
      type: "raster",
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

export const MAP_STYLES: Record<MapVariant, string | StyleSpecification> = {
  white: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
  geo: TOPO_STYLE,
  satellite: SATELLITE_STYLE
};
