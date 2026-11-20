import os
import sys
import glob
import json
import csv
import hashlib
import argparse
from datetime import datetime, timezone
from typing import Any
import psycopg
from app.config import settings


def normalize_string(val: str | None) -> str:
    if not val:
        return ""
    s = " ".join(str(val).strip().split())
    if s.lower().startswith("общ. ") or s.lower().startswith("община "):
        parts = s.split(" ", 1)
        if len(parts) > 1:
            s = parts[1].strip()
    if s.lower().startswith("обл. ") or s.lower().startswith("област "):
        parts = s.split(" ", 1)
        if len(parts) > 1:
            s = parts[1].strip()
    return s


def parse_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        s = str(val).strip().replace(",", ".")
        f = float(s)
        return f
    except (ValueError, TypeError):
        return None


def parse_int(val: Any, default: int = 0) -> int:
    if val is None:
        return default
    try:
        return int(float(str(val).strip().replace(",", ".")))
    except (ValueError, TypeError):
        return default


def parse_datetime(val: Any) -> datetime | None:
    if not val:
        return None
    s = str(val).strip()
    formats = [
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S%z",
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%d",
        "%d.%m.%Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def extract_field(record: dict, aliases: list[str]) -> Any:
    for alias in aliases:
        if alias in record and record[alias] is not None:
            return record[alias]
        for k in record.keys():
            if k.strip().lower() == alias.lower():
                return record[k]
    return None


def compute_hash(fields: tuple) -> str:
    serialized = "|".join(str(f) for f in fields)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def load_records_from_file(file_path: str) -> list[dict]:
    if not os.path.exists(file_path):
        return []
    records = []
    if file_path.endswith(".json") or file_path.endswith(".ndjson"):
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                if isinstance(data, list):
                    records = data
                elif isinstance(data, dict):
                    if "records" in data and isinstance(data["records"], list):
                        records = data["records"]
                    elif "data" in data and isinstance(data["data"], list):
                        records = data["data"]
                    elif "features" in data and isinstance(data["features"], list):
                        for feat in data["features"]:
                            props = feat.get("properties", {})
                            geom = feat.get("geometry", {})
                            if geom and geom.get("type") == "Point":
                                coords = geom.get("coordinates", [])
                                if len(coords) >= 2:
                                    props["lon"] = coords[0]
                                    props["lat"] = coords[1]
                            records.append(props)
                    else:
                        records = [data]
            except Exception:
                f.seek(0)
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            records.append(json.loads(line))
                        except Exception:
                            continue
    elif file_path.endswith(".csv"):
        with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
            sample = f.read(4096)
            f.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample)
            except Exception:
                dialect = csv.excel
            reader = csv.DictReader(f, dialect=dialect)
            for row in reader:
                records.append(row)
    return records


def ingest_crashes(file_path: str | None = None) -> tuple[int, int]:
    target_path = file_path
    if not target_path or not os.path.exists(target_path):
        candidates = []
        for p in [
            "data/raw/*",
            "/app/data/raw/*",
            "../data/raw/*",
            "../../data/raw/*",
        ]:
            candidates.extend(glob.glob(p))
        valid_candidates = [c for c in candidates if (c.endswith(".json") or c.endswith(".csv") or c.endswith(".ndjson")) and "nsi" not in c.lower()]
        if valid_candidates:
            target_path = valid_candidates[0]
        else:
            for p in [
                "data/sample/crashes_sample.json",
                "/app/data/sample/crashes_sample.json",
                "../data/sample/crashes_sample.json",
                "../../data/sample/crashes_sample.json",
            ]:
                if os.path.exists(p):
                    target_path = p
                    break

    if not target_path or not os.path.exists(target_path):
        print("No valid crash data file found.")
        return 0, 0

    print(f"Ingesting crash records from: {target_path}")
    raw_records = load_records_from_file(target_path)
    if not raw_records:
        print("No records extracted from file.")
        return 0, 0

    rows_to_insert = []
    dropped_count = 0

    lat_aliases = ["lat", "latitude", "ширина", "географска ширина", "y", "wgs84_y"]
    lon_aliases = ["lon", "lng", "longitude", "дължина", "географска дължина", "x", "wgs84_x"]
    time_aliases = ["occurred_at", "date", "datetime", "дата", "дата_час", "timestamp", "дата и час"]
    region_aliases = ["region", "област", "district"]
    muni_aliases = ["municipality", "община"]
    settlement_aliases = ["settlement", "населено място", "населено_място", "град_село", "place"]
    road_class_aliases = ["road_class", "клас път", "клас_път", "клас", "road_category"]
    crash_type_aliases = ["crash_type", "вид птп", "вид_птп", "вид", "тип", "category"]
    killed_aliases = ["killed", "загинали", "убити", "смъртни случаи", "dead", "fatalities"]
    injured_aliases = ["injured", "ранени", "пострадали", "ранен"]

    for rec in raw_records:
        lat = parse_float(extract_field(rec, lat_aliases))
        lon = parse_float(extract_field(rec, lon_aliases))

        if lat is None or lon is None:
            dropped_count += 1
            continue

        if not (41.2 <= lat <= 44.3 and 22.3 <= lon <= 28.7):
            dropped_count += 1
            continue

        dt_val = extract_field(rec, time_aliases)
        dt = parse_datetime(dt_val)
        if dt is None:
            year = parse_int(extract_field(rec, ["year", "година"]), 2023)
            month = parse_int(extract_field(rec, ["month", "месец"]), 1)
            day = parse_int(extract_field(rec, ["day", "ден"]), 1)
            hour = parse_int(extract_field(rec, ["hour", "час"]), 12)
            try:
                dt = datetime(year, max(1, min(12, month)), max(1, min(28, day)), max(0, min(23, hour)), 0, 0, tzinfo=timezone.utc)
            except Exception:
                dt = datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        year = dt.year
        month = dt.month
        day_of_week = dt.weekday()
        hour = dt.hour

        region = normalize_string(extract_field(rec, region_aliases)) or "Неизвестна област"
        municipality = normalize_string(extract_field(rec, muni_aliases)) or "Неизвестна община"
        settlement = normalize_string(extract_field(rec, settlement_aliases)) or None
        road_class = normalize_string(extract_field(rec, road_class_aliases)) or "Общински път"
        crash_type = normalize_string(extract_field(rec, crash_type_aliases)) or "Друг вид ПТП"
        killed = parse_int(extract_field(rec, killed_aliases), 0)
        injured = parse_int(extract_field(rec, injured_aliases), 0)

        source_hash = compute_hash((dt.isoformat(), round(lat, 6), round(lon, 6), municipality, crash_type, killed, injured))

        rows_to_insert.append((
            source_hash,
            dt,
            year,
            month,
            day_of_week,
            hour,
            region,
            municipality,
            settlement,
            road_class,
            crash_type,
            killed,
            injured,
            lat,
            lon,
            lon,
            lat,
            json.dumps(rec, ensure_ascii=False),
        ))

    insert_query = """
    INSERT INTO crashes (
        source_hash, occurred_at, year, month, day_of_week, hour,
        region, municipality, settlement, road_class, crash_type,
        killed, injured, lat, lon, geom, raw_payload
    )
    VALUES (
        %s, %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s::jsonb
    )
    ON CONFLICT (source_hash) DO NOTHING;
    """

    inserted_count = 0
    with psycopg.connect(settings.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            batch_size = 1000
            for i in range(0, len(rows_to_insert), batch_size):
                batch = rows_to_insert[i:i + batch_size]
                cur.executemany(insert_query, batch)
            conn.commit()
            cur.execute("SELECT COUNT(*) FROM crashes;")
            res = cur.fetchone()
            inserted_count = res[0] if res else len(rows_to_insert)

    print(f"Ingestion complete: {inserted_count} records currently in DB. Dropped invalid: {dropped_count}")
    return inserted_count, dropped_count


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", type=str, default=None)
    args = parser.parse_args()
    ingest_crashes(args.file)
