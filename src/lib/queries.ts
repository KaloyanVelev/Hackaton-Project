import type { Bounds, Crash, CrashPage, Snapshot } from "./crashes.ts";
import { database } from "./db.ts";

const snapshotFields = `
  s.id, s.source_count AS "sourceCount", s.mapped_count AS "mappedCount",
  s.missing_coordinates AS "missingCoordinates", s.invalid_coordinates AS "invalidCoordinates",
  s.outside_country AS "outsideCountry", s.exact_repeats AS "exactRepeats",
  to_char(s.first_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "firstAt",
  to_char(s.last_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "lastAt"`;

const crashFields = `
  row_no AS id, severity, injured, deaths, region, municipality, location,
  crash_type AS "crashType", to_char(occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS "occurredAt",
  ST_X(geom) AS longitude, ST_Y(geom) AS latitude`;

export async function getCurrentSnapshot() {
  const { rows } = await database().query<Snapshot>(`
    SELECT ${snapshotFields}
    FROM crash_snapshots s JOIN current_crash_snapshot current ON current.snapshot_id = s.id`);
  return rows[0] ?? null;
}

export async function getPointFeed(snapshotId: string) {
  const { rows } = await database().query<{ points_gzip: Buffer }>(
    "SELECT points_gzip FROM crash_snapshots WHERE id = $1",
    [snapshotId],
  );
  return rows[0]?.points_gzip ?? null;
}

export async function getCrash(snapshotId: string, id: number) {
  const { rows } = await database().query<Crash>(`
    SELECT ${crashFields} FROM crashes
    WHERE snapshot_id = $1 AND row_no = $2 AND geom IS NOT NULL`, [snapshotId, id]);
  return rows[0] ?? null;
}

const pageSize = 30;

export async function listCrashes(snapshotId: string, after: number, bounds: Bounds | null): Promise<CrashPage> {
  const args = [snapshotId, after, pageSize + 1];
  const inBounds = bounds ? "AND geom && ST_MakeEnvelope($4, $5, $6, $7, 4326)" : "";
  const { rows } = await database().query<Crash>(`
    SELECT ${crashFields} FROM crashes
    WHERE snapshot_id = $1 AND row_no > $2 AND geom IS NOT NULL ${inBounds}
    ORDER BY row_no LIMIT $3`, bounds ? [...args, ...bounds] : args);

  const crashes = rows.slice(0, pageSize);
  return { crashes, next: rows.length > pageSize ? crashes[pageSize - 1].id : null };
}
