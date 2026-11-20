import { readFile } from "node:fs/promises";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { database } from "../src/lib/db.ts";
import { getCurrentSnapshot } from "../src/lib/queries.ts";
import { importSnapshot } from "./snapshot-import.ts";

const path = process.argv[2] ?? process.env.CRASH_JSON;
if (!path) throw new Error("Provide the path to the source crash JSON.");

const pool = database();
try {
  const [bytes, boundaryText] = await Promise.all([
    readFile(path),
    readFile(new URL("../public/maps/bulgaria.geojson", import.meta.url), "utf8"),
  ]);
  const boundary = JSON.parse(boundaryText) as FeatureCollection<Polygon | MultiPolygon>;
  const result = await importSnapshot(pool, bytes, boundary.features[0].geometry);
  console.log(JSON.stringify({ action: result.action, snapshot: await getCurrentSnapshot() }, null, 2));
} finally {
  await pool.end();
}
