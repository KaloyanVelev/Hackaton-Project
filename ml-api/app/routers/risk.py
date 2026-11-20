import json
import httpx
from fastapi import APIRouter
from app.db import get_db_connection
from app.ml.predictor import predict_fatal_risk
from app.schemas import (
    PredictRiskRequest,
    PredictRiskResponse,
    TripRiskRequest,
    TripRiskResponse,
    TripHotspotSegment,
)

router = APIRouter(tags=["risk"])


@router.post("/predict-risk", response_model=PredictRiskResponse)
def post_predict_risk(payload: PredictRiskRequest):
    res = predict_fatal_risk(
        municipality=payload.municipality,
        day_of_week=payload.day_of_week,
        hour=payload.hour,
        month=payload.month,
        road_class=payload.road_class,
    )
    return PredictRiskResponse(**res)


@router.post("/trip-risk", response_model=TripRiskResponse)
def post_trip_risk(payload: TripRiskRequest):
    osrm_url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{payload.origin_lon},{payload.origin_lat};{payload.dest_lon},{payload.dest_lat}"
        f"?overview=full&geometries=geojson"
    )

    used_osrm = False
    route_geojson = None
    distance_km = 0.0

    try:
        r = httpx.get(osrm_url, timeout=4.0)
        if r.status_code == 200:
            data = r.json()
            routes = data.get("routes", [])
            if routes:
                route_geojson = routes[0].get("geometry")
                distance_km = round(routes[0].get("distance", 0.0) / 1000.0, 1)
                used_osrm = True
    except Exception:
        used_osrm = False

    if not route_geojson:
        route_geojson = {
            "type": "LineString",
            "coordinates": [
                [payload.origin_lon, payload.origin_lat],
                [payload.dest_lon, payload.dest_lat],
            ],
        }

    geojson_str = json.dumps(route_geojson)
    buf = payload.buffer_meters
    dep_h = payload.departure_hour

    h_min = (dep_h - 2) % 24
    h_max = (dep_h + 2) % 24

    if h_min <= h_max:
        hour_cond = f"(hour >= {h_min} AND hour <= {h_max})"
    else:
        hour_cond = f"(hour >= {h_min} OR hour <= {h_max})"

    total_corridor = 0
    window_crashes = 0
    fatal_crashes = 0
    hotspot_segments: list[TripHotspotSegment] = []

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            if distance_km == 0.0:
                cur.execute("""
                    SELECT ST_Length(ST_GeomFromGeoJSON(%s)::geography) / 1000.0;
                """, (geojson_str,))
                dist_row = cur.fetchone()
                if dist_row and dist_row[0]:
                    distance_km = round(float(dist_row[0]), 1)

            cur.execute(f"""
                WITH corridor AS (
                    SELECT ST_GeomFromGeoJSON(%s) AS geom
                )
                SELECT
                    COUNT(*),
                    COUNT(*) FILTER (WHERE {hour_cond}),
                    COUNT(*) FILTER (WHERE is_fatal)
                FROM crashes c, corridor
                WHERE ST_DWithin(c.geom::geography, corridor.geom::geography, %s);
            """, (geojson_str, buf))
            counts_row = cur.fetchone()
            if counts_row:
                total_corridor = counts_row[0] or 0
                window_crashes = counts_row[1] or 0
                fatal_crashes = counts_row[2] or 0

            cur.execute(f"""
                WITH corridor AS (
                    SELECT ST_GeomFromGeoJSON(%s) AS geom
                )
                SELECT
                    ROUND(AVG(c.lat)::numeric, 4),
                    ROUND(AVG(c.lon)::numeric, 4),
                    COUNT(*),
                    COUNT(*) FILTER (WHERE c.is_fatal),
                    MODE() WITHIN GROUP (ORDER BY c.crash_type)
                FROM crashes c, corridor
                WHERE ST_DWithin(c.geom::geography, corridor.geom::geography, %s)
                GROUP BY ST_SnapToGrid(c.geom, 0.015)
                HAVING COUNT(*) >= 2
                ORDER BY COUNT(*) DESC
                LIMIT 5;
            """, (geojson_str, buf))
            for r in cur.fetchall():
                hotspot_segments.append(TripHotspotSegment(
                    lat=float(r[0]),
                    lon=float(r[1]),
                    crash_count=r[2],
                    fatal_count=r[3],
                    description=f"{r[4]} ({r[2]} регистрирани катастрофи в участъка)",
                ))

    rate_per_km = total_corridor / max(1.0, distance_km)
    if fatal_crashes >= 3 or rate_per_km > 0.8:
        risk_tier = "CRITICAL"
    elif fatal_crashes >= 1 or rate_per_km > 0.4:
        risk_tier = "HIGH"
    elif total_corridor > 5 or rate_per_km > 0.2:
        risk_tier = "MODERATE"
    else:
        risk_tier = "LOW"

    driver_warnings = []
    if dep_h >= 21 or dep_h <= 5:
        driver_warnings.append("Пътуване в тъмната част на денонощието: увеличете дистанцията и следете за диви животни и несигнализирани превозни средства.")
    if dep_h in [7, 8, 9, 17, 18, 19]:
        driver_warnings.append("Интензивен пиков трафик: повишен риск от верижни сблъсъци на изходите на населените места.")
    if fatal_crashes > 0:
        driver_warnings.append(f"Внимание: по коридора са регистрирани {fatal_crashes} катастрофи със загинали. Спазвайте стриктно ограниченията на скоростта.")
    if not driver_warnings:
        driver_warnings.append("Стандартни пътни условия по маршрута. Шофирайте с повишено внимание.")

    return TripRiskResponse(
        route_geojson=route_geojson,
        used_osrm=used_osrm,
        distance_km=distance_km,
        total_corridor_crashes=total_corridor,
        window_crashes=window_crashes,
        fatal_crashes=fatal_crashes,
        risk_tier=risk_tier,
        hotspot_segments=hotspot_segments,
        driver_warnings=driver_warnings,
    )
