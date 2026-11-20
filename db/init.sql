CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS crashes (
    id BIGSERIAL PRIMARY KEY,
    source_hash TEXT NOT NULL UNIQUE,
    occurred_at TIMESTAMPTZ NOT NULL,
    year SMALLINT NOT NULL,
    month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
    region TEXT NOT NULL,
    municipality TEXT NOT NULL,
    settlement TEXT,
    road_class TEXT,
    crash_type TEXT NOT NULL,
    killed SMALLINT NOT NULL DEFAULT 0 CHECK (killed >= 0),
    injured SMALLINT NOT NULL DEFAULT 0 CHECK (injured >= 0),
    is_fatal BOOLEAN GENERATED ALWAYS AS (killed > 0) STORED,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS road_network_stats (
    id SERIAL PRIMARY KEY,
    region TEXT NOT NULL,
    year SMALLINT NOT NULL,
    road_class TEXT NOT NULL,
    length_km DOUBLE PRECISION NOT NULL CHECK (length_km >= 0),
    UNIQUE (region, year, road_class)
);

CREATE INDEX IF NOT EXISTS idx_crashes_geom ON crashes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_crashes_muni_time ON crashes (municipality, day_of_week, hour);
CREATE INDEX IF NOT EXISTS idx_crashes_charts ON crashes (month, hour);
CREATE INDEX IF NOT EXISTS idx_crashes_fatal ON crashes (is_fatal);
CREATE INDEX IF NOT EXISTS idx_crashes_year_month ON crashes (year, month);
