import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import pg from "pg";
import type { FeatureCollection, Polygon } from "geojson";
import type { CrashFilters, CrashPoints } from "../src/lib/crashes.ts";
import { buildFilterClauses } from "../src/lib/queries.ts";
import { columns } from "../scripts/snapshot-input.ts";
import { importSnapshot } from "../scripts/snapshot-import.ts";

function source(...rows: Array<Record<string, string | null>>) {
  return Buffer.from(JSON.stringify([columns, ...rows.map((row) => columns.map((field) => row[field] ?? null))]));
}

test("PostGIS preserves all rows, clips points and replaces snapshots atomically", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "Run against a PostGIS database using DATABASE_URL.");
  const schema = `street_aware_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({ connectionString });
  const isolated = new pg.Pool({ connectionString, options: `-c search_path=${schema},public` });

  try {
    await admin.query("CREATE EXTENSION IF NOT EXISTS postgis");
    await admin.query(`CREATE SCHEMA ${schema}`);
    await isolated.query(await readFile(new URL("../scripts/schema.sql", import.meta.url), "utf8"));
    const { features } = JSON.parse(
      await readFile(new URL("../public/maps/bulgaria.geojson", import.meta.url), "utf8"),
    ) as FeatureCollection<Polygon>;
    const country = features[0].geometry;

    const sofia = {
      longitude: "23.3219002", latitude: "42.6977001", diedcount: "0", injuredcount: "0",
      crashdatetime: "2024-01-01 01:00:00", crashtype: "друг вид ПТП",
    };
    const firstFile = source(
      sofia, sofia,
      { ...sofia, diedcount: "0", injuredcount: "1" },
      { ...sofia, diedcount: "1", injuredcount: "2" },
      { ...sofia, diedcount: null },
      { ...sofia, longitude: null },
      { ...sofia, latitude: "100" },
      { ...sofia, longitude: "26.10", latitude: "44.43" },
    );
    const first = await importSnapshot(isolated, firstFile, country);
    assert.equal(first.action, "imported");
    const initial = await isolated.query(
      "SELECT source_count, mapped_count, missing_coordinates, invalid_coordinates, outside_country, exact_repeats, points_gzip FROM crash_snapshots WHERE id=$1",
      [first.id],
    );
    const { points_gzip: gzip, ...counts } = initial.rows[0];
    assert.deepEqual(counts, {
      source_count: 8, mapped_count: 5, missing_coordinates: 1,
      invalid_coordinates: 1, outside_country: 1, exact_repeats: 1,
    });
    const points = JSON.parse(gunzipSync(gzip).toString("utf8")) as CrashPoints;
    assert.deepEqual(points.features.map((feature) => feature.properties.severity), ["none", "none", "injury", "fatal", "unknown"]);
    assert.deepEqual(points.features.map((feature) => feature.id), [1, 2, 3, 4, 5]);
    assert.deepEqual(points.features[0].geometry.coordinates, [23.3219002, 42.6977001]);
    assert.equal((await importSnapshot(isolated, firstFile, country)).action, "unchanged");

    const second = await importSnapshot(isolated, source({ ...sofia, crashdatetime: "2026-11-20 07:45:00" }), country);
    assert.notEqual(second.id, first.id);
    await isolated.query("ALTER TABLE crashes ADD CHECK (coalesce(crash_type, '') <> 'fixture rejects insert')");
    await assert.rejects(importSnapshot(isolated, source({ ...sofia, crashtype: "fixture rejects insert" }), country));
    const active = await isolated.query("SELECT snapshot_id FROM current_crash_snapshot");
    assert.equal(active.rows[0].snapshot_id, second.id);
    const stored = await isolated.query("SELECT id FROM crash_snapshots ORDER BY id");
    assert.deepEqual(stored.rows.map(({ id }) => id), [first.id, second.id].sort());
    assert.equal((await importSnapshot(isolated, firstFile, country)).action, "activated");
  } finally {
    await isolated.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});

test("Postgres filters use the recorded local time and reject malformed fallback metadata", async () => {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString);
  const pool = new pg.Pool({ connectionString });
  try {
    async function matching(filters: CrashFilters) {
      const { sql, values } = buildFilterClauses(filters);
      const result = await pool.query<{ id: number }>(`
        WITH crashes (id, occurred_at, raw) AS (VALUES
          (1, timestamp '2025-01-04 18:00', '{"dayofweek":"3","hourofday":"12","year":"2024","ptp_place":"в населено място"}'::jsonb),
          (2, timestamp '2025-01-06 06:00', '{"dayofweek":"6","hourofday":"18","year":"2024","ptp_place":"извън населено място"}'::jsonb),
          (3, NULL, '{"dayofweek":"7","hourofday":" 05 ","year":"2024"}'::jsonb),
          (4, NULL, '{"dayofweek":"1","hourofday":"17","year":"2024"}'::jsonb),
          (5, NULL, '{"dayofweek":"invalid","hourofday":" 99999999999999 ","year":"unknown"}'::jsonb)
        ) SELECT id FROM crashes WHERE true ${sql} ORDER BY id`, values);
      return result.rows.map(({ id }) => id);
    }
    assert.deepEqual(await matching({ dayOfWeek: "weekday" }), [2, 4]);
    assert.deepEqual(await matching({ dayOfWeek: "weekend" }), [1, 3]);
    assert.deepEqual(await matching({ timeOfDay: "day" }), [2, 4]);
    assert.deepEqual(await matching({ timeOfDay: "night" }), [1, 3]);
    assert.deepEqual(await matching({ year: 2024 }), [3, 4]);
    assert.deepEqual(await matching({ year: 2025, place: "urban", dayOfWeek: "weekend" }), [1]);
    assert.deepEqual(await matching({ year: 2025, place: "rural", dayOfWeek: "weekday" }), [2]);
  } finally {
    await pool.end();
  }
});
