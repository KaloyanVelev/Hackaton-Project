import type { LineString } from "geojson";
import { database } from "./db";
import { tripPrototype, type TripPoint, type TripRequest } from "./trip";

export async function estimateTripPoints(route: LineString, input: Pick<TripRequest, "hour" | "weekday" | "month" | "points">) {
  const { rows } = await database().query<TripPoint>(`
    WITH route AS MATERIALIZED (
      SELECT ST_GeomFromGeoJSON($1)::geography AS path
    ),
    samples AS (
      SELECT i + 1 AS number, ST_LineInterpolatePoint(path, i::float8 / ($5 - 1), true) AS point,
             ST_Length(path) * i / ($5 - 1) / 1000 AS distance_km
      FROM route CROSS JOIN generate_series(0, $5::integer - 1) i
    ),
    historical AS MATERIALIZED (
      SELECT geom::geography AS place, (deaths > 0)::integer AS fatal,
             abs(EXTRACT(hour FROM occurred_at)::integer - $2) AS hour_diff,
             abs(EXTRACT(month FROM occurred_at)::integer - $4) AS month_diff
      FROM crashes JOIN current_crash_snapshot USING (snapshot_id)
      WHERE geom IS NOT NULL AND occurred_at IS NOT NULL AND deaths IS NOT NULL AND raw->>'ismajor' = '1'
        AND EXTRACT(isodow FROM occurred_at)::integer = $3
    ),
    cohort AS MATERIALIZED (
      SELECT place, fatal FROM historical
      WHERE LEAST(hour_diff, 24 - hour_diff) <= $7
        AND LEAST(month_diff, 12 - month_diff) <= $8
    ),
    baseline AS (
      SELECT (sum(fatal) + 1)::float8 / (count(*) + 2) AS rate FROM cohort HAVING count(*) > 0
    )
    SELECT number, ST_X(point::geometry) AS longitude, ST_Y(point::geometry) AS latitude,
           distance_km AS "distanceKm", nearby.total AS "majorCrashes",
           (nearby.fatal + $9 * baseline.rate) / (nearby.total + $9) AS probability
    FROM samples CROSS JOIN baseline
    CROSS JOIN LATERAL (
      SELECT count(*)::int AS total, COALESCE(sum(fatal), 0) AS fatal FROM cohort
      WHERE ST_DWithin(place, point, $6)
    ) nearby
    ORDER BY number`, [JSON.stringify(route), input.hour, input.weekday, input.month, input.points,
    tripPrototype.radiusKm * 1_000, tripPrototype.hourWindow, tripPrototype.monthWindow, tripPrototype.nationalWeight]);
  return rows;
}
