import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { countryBounds, mapStyle, streetSource, type Country } from "../src/lib/map-style.ts";

const country = JSON.parse(readFileSync(new URL("../public/maps/bulgaria.geojson", import.meta.url), "utf8")) as Country;
const bounds = countryBounds(country);

test("an unusable hosted style falls back to the white national map and direct OSM roads", () => {
  const fallback = mapStyle(country, bounds, null);
  assert.deepEqual(validateStyleMin(fallback), []);
  assert.ok(fallback.layers.some(({ id }) => id === "osm-roads"));
  assert.deepEqual(mapStyle(country, bounds, { version: 8, sources: null, layers: [null] }), fallback);
  assert.deepEqual(mapStyle(country, bounds, {
    version: 8,
    sources: { roads: { type: "vector", url: "https://example.invalid/tilejson.json" } },
    layers: [{ id: "invalid", type: "line", source: "roads", "source-layer": "streets", paint: { "line-width": "invalid" } }],
  }), fallback);
});

test("the hosted street source uses Bulgaria bounds and crash symbols follow the mask", () => {
  const style = mapStyle(country, bounds, {
    version: 8,
    sources: { roads: { type: "vector", url: "https://example.invalid/tilejson.json" } },
    layers: [{ id: "roads", type: "line", source: "roads", "source-layer": "streets" }],
  });
  const source = style.sources[streetSource];
  assert.equal(source.type, "vector");
  assert.equal(source.url, "https://example.invalid/tilejson.json");
  assert.deepEqual(source.bounds, bounds);
  const layers = style.layers.map(({ id }) => id);
  assert.ok(layers.indexOf("osm-roads") < layers.indexOf("country-mask"));
  assert.ok(layers.indexOf("country-mask") < layers.indexOf("cluster-count"));
});
