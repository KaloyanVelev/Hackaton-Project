from fastapi import APIRouter, HTTPException, Query
from app.db import get_db_connection
from app.schemas import (
    CrashFeatureCollection,
    CrashFeature,
    CrashFeatureGeometry,
    CrashFeatureProperties,
    CrashDetail,
    HotspotItem,
)

router = APIRouter(tags=["crashes"])


@router.get("/crashes", response_model=CrashFeatureCollection)
def get_crashes(
    min_lat: float = Query(41.2, ge=41.0, le=44.5),
    max_lat: float = Query(44.3, ge=41.0, le=44.5),
    min_lon: float = Query(22.3, ge=22.0, le=29.0),
    max_lon: float = Query(28.7, ge=22.0, le=29.0),
    municipality: str | None = None,
    month: int | None = Query(None, ge=1, le=12),
    day_of_week: int | None = Query(None, ge=0, le=6),
    hour_from: int | None = Query(None, ge=0, le=23),
    hour_to: int | None = Query(None, ge=0, le=23),
    fatal_only: bool = False,
    crash_type: str | None = None,
    limit: int = Query(5000, ge=1, le=25000),
):
    query = """
        SELECT id, occurred_at, municipality, crash_type, killed, injured, is_fatal, lon, lat
        FROM crashes
        WHERE geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
    """
    params: list[object] = [min_lon, min_lat, max_lon, max_lat]

    if municipality:
        query += " AND municipality ILIKE %s"
        params.append(f"%{municipality.strip()}%")
    if month is not None:
        query += " AND month = %s"
        params.append(month)
    if day_of_week is not None:
        query += " AND day_of_week = %s"
        params.append(day_of_week)
    if hour_from is not None:
        query += " AND hour >= %s"
        params.append(hour_from)
    if hour_to is not None:
        query += " AND hour <= %s"
        params.append(hour_to)
    if fatal_only:
        query += " AND is_fatal = TRUE"
    if crash_type:
        query += " AND crash_type ILIKE %s"
        params.append(f"%{crash_type.strip()}%")

    query += " ORDER BY id DESC LIMIT %s;"
    params.append(limit)

    features = []
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            for r in rows:
                c_id, dt, muni, c_type, killed, injured, is_fatal, lon, lat = r
                features.append(CrashFeature(
                    geometry=CrashFeatureGeometry(coordinates=[lon, lat]),
                    properties=CrashFeatureProperties(
                        id=c_id,
                        occurred_at=dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                        municipality=muni,
                        crash_type=c_type,
                        killed=killed,
                        injured=injured,
                        is_fatal=is_fatal,
                    ),
                ))

    return CrashFeatureCollection(features=features)


@router.get("/crashes/{id}", response_model=CrashDetail)
def get_crash_detail(id: int):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id, source_hash, occurred_at, year, month, day_of_week, hour,
                    region, municipality, settlement, road_class, crash_type,
                    killed, injured, is_fatal, lat, lon, raw_payload
                FROM crashes
                WHERE id = %s;
            """, (id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Crash record not found")

            (
                c_id, source_hash, dt, year, month, day_of_week, hour,
                region, municipality, settlement, road_class, crash_type,
                killed, injured, is_fatal, lat, lon, raw_payload
            ) = row

            cur.execute("""
                SELECT COUNT(*) - 1
                FROM crashes
                WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, 500);
            """, (lon, lat))
            nearby_count_row = cur.fetchone()
            nearby_count = max(0, nearby_count_row[0] if nearby_count_row else 0)

            return CrashDetail(
                id=c_id,
                source_hash=source_hash,
                occurred_at=dt.isoformat() if hasattr(dt, "isoformat") else str(dt),
                year=year,
                month=month,
                day_of_week=day_of_week,
                hour=hour,
                region=region,
                municipality=municipality,
                settlement=settlement,
                road_class=road_class,
                crash_type=crash_type,
                killed=killed,
                injured=injured,
                is_fatal=is_fatal,
                lat=lat,
                lon=lon,
                nearby_500m_count=nearby_count,
                raw_payload=raw_payload or {},
            )


@router.get("/hotspots", response_model=list[HotspotItem])
def get_hotspots(
    municipality: str | None = None,
    month: int | None = Query(None, ge=1, le=12),
    hour_from: int | None = Query(None, ge=0, le=23),
    hour_to: int | None = Query(None, ge=0, le=23),
    fatal_only: bool = False,
    grid_deg: float = Query(0.015, ge=0.005, le=0.05),
    limit: int = Query(25, ge=1, le=100),
):
    query = """
        SELECT
            ROUND(AVG(lat)::numeric, 4) as center_lat,
            ROUND(AVG(lon)::numeric, 4) as center_lon,
            COUNT(*) as crash_count,
            COUNT(*) FILTER (WHERE is_fatal) as fatal_count,
            COALESCE(SUM(injured), 0) as injured_count,
            MODE() WITHIN GROUP (ORDER BY hour) as peak_hour,
            MODE() WITHIN GROUP (ORDER BY crash_type) as top_crash_type,
            MODE() WITHIN GROUP (ORDER BY municipality) as municipality
        FROM crashes
        WHERE 1=1
    """
    params = []

    if municipality:
        query += " AND municipality ILIKE %s"
        params.append(f"%{municipality.strip()}%")
    if month is not None:
        query += " AND month = %s"
        params.append(month)
    if hour_from is not None:
        query += " AND hour >= %s"
        params.append(hour_from)
    if hour_to is not None:
        query += " AND hour <= %s"
        params.append(hour_to)
    if fatal_only:
        query += " AND is_fatal = TRUE"

    query += f"""
        GROUP BY ST_SnapToGrid(geom, {grid_deg})
        HAVING COUNT(*) >= 2
        ORDER BY crash_count DESC
        LIMIT %s;
    """
    params.append(limit)

    items = []
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            for r in rows:
                items.append(HotspotItem(
                    center_lat=float(r[0]),
                    center_lon=float(r[1]),
                    crash_count=r[2],
                    fatal_count=r[3],
                    injured_count=r[4],
                    peak_hour=r[5] if r[5] is not None else 12,
                    top_crash_type=r[6] or "Сблъсък между МПС",
                    municipality=r[7] or "Неизвестна",
                ))

    return items
