import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { MultiPolygon, Polygon } from "geojson";
import type { Pool, PoolClient } from "pg";
import type { CrashPoints, Severity } from "../src/lib/crashes.ts";
import { parseSnapshot } from "./snapshot-input.ts";

const classifyRows = `
  WITH boundary AS MATERIALIZED (
    SELECT ST_SetSRID(ST_GeomFromGeoJSON($3::text), 4326) AS geom
  ), candidates AS (
    SELECT entry.*, CASE WHEN entry.coordinate_status = 'valid' THEN
      ST_SetSRID(ST_MakePoint(entry.longitude, entry.latitude), 4326)
    END AS point
    FROM jsonb_to_recordset($2::jsonb) AS entry(
      row_no int, raw jsonb, occurred_at timestamp, deaths int, injured int, severity text,
      region text, municipality text, location text, crash_type text, longitude float8,
      latitude float8, coordinate_status text
    )
  ), classified AS MATERIALIZED (
    SELECT candidates.*, ST_Covers(boundary.geom, candidates.point) AS covered
    FROM candidates CROSS JOIN boundary
  )
  INSERT INTO crashes (
    snapshot_id, row_no, raw, occurred_at, deaths, injured, severity,
    region, municipality, location, crash_type, coordinate_status, geom
  )
  SELECT $1, row_no, raw, occurred_at, deaths, injured, severity,
    region, municipality, location, crash_type,
    CASE WHEN covered THEN 'mapped' WHEN coordinate_status = 'valid' THEN 'outside' ELSE coordinate_status END,
    CASE WHEN covered THEN point END
  FROM classified`;

async function activate(client: PoolClient, id: string) {
  await client.query(`
    INSERT INTO current_crash_snapshot (singleton, snapshot_id) VALUES (true, $1)
    ON CONFLICT (singleton) DO UPDATE SET snapshot_id = EXCLUDED.snapshot_id`, [id]);
}

export async function importSnapshot(pool: Pool, bytes: Buffer, boundary: Polygon | MultiPolygon) {
  const id = createHash("sha256").update(bytes).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(78261492)");
    const prior = await client.query<{ active: boolean }>(`
      SELECT EXISTS(SELECT 1 FROM current_crash_snapshot WHERE snapshot_id = $1) AS active
      FROM crash_snapshots WHERE id = $1`, [id]);
    if (prior.rows[0]) {
      const active = prior.rows[0].active;
      if (!active) await activate(client, id);
      await client.query("COMMIT");
      return { id, action: active ? "unchanged" : "activated" } as const;
    }

    const { rows, exactRepeats } = parseSnapshot(bytes.toString("utf8"));
    const geometry = JSON.stringify(boundary);
    const checked = await client.query<{ valid: boolean }>(`
      SELECT ST_IsValid(geom) AND NOT ST_IsEmpty(geom) AS valid
      FROM (SELECT ST_GeomFromGeoJSON($1::text) AS geom) boundary`, [geometry]);
    if (!checked.rows[0]?.valid) throw new Error("The Bulgaria boundary is empty or invalid.");

    await client.query("INSERT INTO crash_snapshots (id) VALUES ($1)", [id]);
    const batchSize = 4_000;
    for (let start = 0; start < rows.length; start += batchSize) {
      await client.query(classifyRows, [id, JSON.stringify(rows.slice(start, start + batchSize)), geometry]);
    }

    const points = await client.query<{ id: number; longitude: number; latitude: number; severity: Severity }>(`
      SELECT row_no AS id, ST_X(geom) AS longitude, ST_Y(geom) AS latitude, severity
      FROM crashes WHERE snapshot_id = $1 AND geom IS NOT NULL ORDER BY row_no`, [id]);
    const collection: CrashPoints = {
      type: "FeatureCollection",
      features: points.rows.map(({ id: crashId, longitude, latitude, severity }) => ({
        type: "Feature",
        id: crashId,
        geometry: { type: "Point", coordinates: [longitude, latitude] },
        properties: { crashId, severity },
      })),
    };
    const feed = gzipSync(JSON.stringify(collection));

    await client.query(`
      WITH totals AS (
        SELECT count(*)::int AS source_count,
          count(*) FILTER (WHERE coordinate_status = 'mapped')::int AS mapped_count,
          count(*) FILTER (WHERE coordinate_status = 'missing')::int AS missing_coordinates,
          count(*) FILTER (WHERE coordinate_status = 'invalid')::int AS invalid_coordinates,
          count(*) FILTER (WHERE coordinate_status = 'outside')::int AS outside_country,
          min(occurred_at) AS first_at, max(occurred_at) AS last_at
        FROM crashes WHERE snapshot_id = $1
      )
      UPDATE crash_snapshots s SET source_count = totals.source_count, mapped_count = totals.mapped_count,
        missing_coordinates = totals.missing_coordinates, invalid_coordinates = totals.invalid_coordinates,
        outside_country = totals.outside_country, exact_repeats = $2,
        first_at = totals.first_at, last_at = totals.last_at, points_gzip = $3
      FROM totals WHERE s.id = $1`, [id, exactRepeats, feed]);

    await activate(client, id);
    await client.query("COMMIT");
    return { id, action: "imported" } as const;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
