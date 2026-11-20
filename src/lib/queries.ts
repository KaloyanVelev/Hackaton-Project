import type { AggregatedStats, Bounds, Crash, CrashPage, Snapshot } from "./crashes.ts";
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

export async function getAggregatedStats(snapshotId: string): Promise<AggregatedStats> {
  const db = database();
  const [
    totalsRes,
    hourlyRes,
    crashTypesRes,
    regionsRes,
    dayOfWeekRes,
    urbanRuralRes,
    monthlyRes,
    roadFeaturesRes
  ] = await Promise.all([
    db.query<{ totalCrashes: number; totalDeaths: number; totalInjured: number }>(`
      SELECT count(*)::int AS "totalCrashes",
             coalesce(sum(deaths), 0)::int AS "totalDeaths",
             coalesce(sum(injured), 0)::int AS "totalInjured"
      FROM crashes WHERE snapshot_id = $1`, [snapshotId]),
    db.query<{ hour: number; count: number; deaths: number; injured: number }>(`
      SELECT (raw->>'hourofday')::int AS hour,
             count(*)::int AS count,
             coalesce(sum(deaths), 0)::int AS deaths,
             coalesce(sum(injured), 0)::int AS injured
      FROM crashes
      WHERE snapshot_id = $1 AND raw->>'hourofday' ~ '^[0-9]+$'
      GROUP BY 1 ORDER BY 1`, [snapshotId]),
    db.query<{ type: string; count: number; deaths: number; injured: number }>(`
      SELECT crash_type AS type,
             count(*)::int AS count,
             coalesce(sum(deaths), 0)::int AS deaths,
             coalesce(sum(injured), 0)::int AS injured
      FROM crashes
      WHERE snapshot_id = $1 AND crash_type IS NOT NULL AND crash_type != ''
      GROUP BY 1 ORDER BY count DESC LIMIT 10`, [snapshotId]),
    db.query<{ region: string; count: number; deaths: number; injured: number }>(`
      SELECT region,
             count(*)::int AS count,
             coalesce(sum(deaths), 0)::int AS deaths,
             coalesce(sum(injured), 0)::int AS injured
      FROM crashes
      WHERE snapshot_id = $1 AND region IS NOT NULL AND region != ''
      GROUP BY 1 ORDER BY count DESC LIMIT 10`, [snapshotId]),
    db.query<{ day: number; count: number; deaths: number; injured: number }>(`
      SELECT (raw->>'dayofweek')::int AS day,
             count(*)::int AS count,
             coalesce(sum(deaths), 0)::int AS deaths,
             coalesce(sum(injured), 0)::int AS injured
      FROM crashes
      WHERE snapshot_id = $1 AND raw->>'dayofweek' ~ '^[1-7]$'
      GROUP BY 1 ORDER BY 1`, [snapshotId]),
    db.query<{ place: string; count: number; deaths: number; injured: number }>(`
      SELECT coalesce(nullif(raw->>'ptp_place', ''), 'неуточнено') AS place,
             count(*)::int AS count,
             coalesce(sum(deaths), 0)::int AS deaths,
             coalesce(sum(injured), 0)::int AS injured
      FROM crashes
      WHERE snapshot_id = $1 AND raw->>'ptp_place' IS NOT NULL
      GROUP BY 1 ORDER BY count DESC`, [snapshotId]),
    db.query<{ month: number; count: number; deaths: number; injured: number }>(`
      SELECT (raw->>'month')::int AS month,
             count(*)::int AS count,
             coalesce(sum(deaths), 0)::int AS deaths,
             coalesce(sum(injured), 0)::int AS injured
      FROM crashes
      WHERE snapshot_id = $1 AND raw->>'month' ~ '^[0-9]+$'
      GROUP BY 1 ORDER BY 1`, [snapshotId]),
    db.query<{ feature: string; count: number; deaths: number; injured: number }>(`
      SELECT raw->>'ptp_placecharacteristics' AS feature,
             count(*)::int AS count,
             coalesce(sum(deaths), 0)::int AS deaths,
             coalesce(sum(injured), 0)::int AS injured
      FROM crashes
      WHERE snapshot_id = $1 AND raw->>'ptp_placecharacteristics' IS NOT NULL AND raw->>'ptp_placecharacteristics' != ''
      GROUP BY 1 ORDER BY count DESC LIMIT 8`, [snapshotId])
  ]);

  return {
    totals: totalsRes.rows[0] ?? { totalCrashes: 0, totalDeaths: 0, totalInjured: 0 },
    hourly: hourlyRes.rows,
    crashTypes: crashTypesRes.rows,
    regions: regionsRes.rows,
    dayOfWeek: dayOfWeekRes.rows,
    urbanRural: urbanRuralRes.rows,
    monthly: monthlyRes.rows,
    roadFeatures: roadFeaturesRes.rows
  };
}

