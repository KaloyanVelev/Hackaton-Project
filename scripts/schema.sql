CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS crash_snapshots (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz NOT NULL DEFAULT now(),
  source_count integer NOT NULL DEFAULT 0,
  mapped_count integer NOT NULL DEFAULT 0,
  missing_coordinates integer NOT NULL DEFAULT 0,
  invalid_coordinates integer NOT NULL DEFAULT 0,
  outside_country integer NOT NULL DEFAULT 0,
  exact_repeats integer NOT NULL DEFAULT 0,
  first_at timestamp,
  last_at timestamp,
  points_gzip bytea,
  CHECK (source_count = mapped_count + missing_coordinates + invalid_coordinates + outside_country)
);

CREATE TABLE IF NOT EXISTS current_crash_snapshot (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  snapshot_id text NOT NULL REFERENCES crash_snapshots(id)
);

CREATE TABLE IF NOT EXISTS crashes (
  snapshot_id text NOT NULL REFERENCES crash_snapshots(id),
  row_no integer NOT NULL CHECK (row_no > 0),
  raw jsonb NOT NULL,
  occurred_at timestamp,
  deaths integer CHECK (deaths >= 0),
  injured integer CHECK (injured >= 0),
  severity text NOT NULL CHECK (severity IN ('none', 'injury', 'fatal', 'unknown')),
  region text,
  municipality text,
  location text,
  crash_type text,
  coordinate_status text NOT NULL CHECK (coordinate_status IN ('mapped', 'missing', 'invalid', 'outside')),
  geom geometry(Point, 4326),
  CHECK ((coordinate_status = 'mapped') = (geom IS NOT NULL)),
  PRIMARY KEY (snapshot_id, row_no)
);

CREATE INDEX IF NOT EXISTS crashes_mapped_geom_idx ON crashes USING gist (geom) WHERE geom IS NOT NULL;
CREATE INDEX IF NOT EXISTS crashes_mapped_rows_idx ON crashes (snapshot_id, row_no) WHERE geom IS NOT NULL;
