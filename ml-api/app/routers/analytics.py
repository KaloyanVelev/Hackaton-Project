from fastapi import APIRouter, HTTPException, Query
from app.db import get_db_connection
from app.schemas import (
    MunicipalityItem,
    ChartData,
    MonthChartItem,
    HourChartItem,
    DayChartItem,
    CrashTypeChartItem,
    ChartTotals,
    MunicipalReport,
    BlackspotZone,
)

router = APIRouter(tags=["analytics"])


@router.get("/municipalities", response_model=list[MunicipalityItem])
def get_municipalities():
    query = """
        SELECT
            municipality,
            MODE() WITHIN GROUP (ORDER BY region) as region,
            COUNT(*) as total_crashes,
            COUNT(*) FILTER (WHERE is_fatal) as fatal_crashes,
            COALESCE(SUM(injured), 0) as injured_total,
            ROUND(AVG(lat)::numeric, 4) as center_lat,
            ROUND(AVG(lon)::numeric, 4) as center_lon
        FROM crashes
        GROUP BY municipality
        ORDER BY total_crashes DESC;
    """
    items = []
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            for r in cur.fetchall():
                items.append(MunicipalityItem(
                    municipality=r[0],
                    region=r[1] or "България",
                    total_crashes=r[2],
                    fatal_crashes=r[3],
                    injured_total=r[4],
                    center_lat=float(r[5]),
                    center_lon=float(r[6]),
                ))
    return items


@router.get("/charts", response_model=ChartData)
def get_charts(
    municipality: str | None = None,
    year: int | None = Query(None, ge=2015, le=2030),
    fatal_only: bool = False,
):
    where_clauses = ["1=1"]
    params = []

    if municipality:
        where_clauses.append("municipality ILIKE %s")
        params.append(f"%{municipality.strip()}%")
    if year:
        where_clauses.append("year = %s")
        params.append(year)
    if fatal_only:
        where_clauses.append("is_fatal = TRUE")

    where_sql = " AND ".join(where_clauses)

    by_month_dict = {m: {"total": 0, "fatal": 0, "injured": 0} for m in range(1, 13)}
    by_hour_dict = {h: {"total": 0, "fatal": 0, "injured": 0} for h in range(24)}
    by_day_dict = {d: {"total": 0, "fatal": 0} for d in range(7)}
    top_crash_types = []
    totals = ChartTotals(total_crashes=0, total_fatal=0, total_killed=0, total_injured=0)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT
                    COUNT(*),
                    COUNT(*) FILTER (WHERE is_fatal),
                    COALESCE(SUM(killed), 0),
                    COALESCE(SUM(injured), 0)
                FROM crashes
                WHERE {where_sql};
            """, tuple(params))
            tot_row = cur.fetchone()
            if tot_row:
                totals = ChartTotals(
                    total_crashes=tot_row[0],
                    total_fatal=tot_row[1],
                    total_killed=tot_row[2],
                    total_injured=tot_row[3],
                )

            cur.execute(f"""
                SELECT month, COUNT(*), COUNT(*) FILTER (WHERE is_fatal), COALESCE(SUM(injured), 0)
                FROM crashes
                WHERE {where_sql}
                GROUP BY month;
            """, tuple(params))
            for r in cur.fetchall():
                m = r[0]
                if m in by_month_dict:
                    by_month_dict[m] = {"total": r[1], "fatal": r[2], "injured": r[3]}

            cur.execute(f"""
                SELECT hour, COUNT(*), COUNT(*) FILTER (WHERE is_fatal), COALESCE(SUM(injured), 0)
                FROM crashes
                WHERE {where_sql}
                GROUP BY hour;
            """, tuple(params))
            for r in cur.fetchall():
                h = r[0]
                if h in by_hour_dict:
                    by_hour_dict[h] = {"total": r[1], "fatal": r[2], "injured": r[3]}

            cur.execute(f"""
                SELECT day_of_week, COUNT(*), COUNT(*) FILTER (WHERE is_fatal)
                FROM crashes
                WHERE {where_sql}
                GROUP BY day_of_week;
            """, tuple(params))
            for r in cur.fetchall():
                d = r[0]
                if d in by_day_dict:
                    by_day_dict[d] = {"total": r[1], "fatal": r[2]}

            cur.execute(f"""
                SELECT crash_type, COUNT(*)
                FROM crashes
                WHERE {where_sql}
                GROUP BY crash_type
                ORDER BY COUNT(*) DESC
                LIMIT 8;
            """, tuple(params))
            for r in cur.fetchall():
                top_crash_types.append(CrashTypeChartItem(crash_type=r[0], count=r[1]))

    return ChartData(
        by_month=[MonthChartItem(month=m, **by_month_dict[m]) for m in range(1, 13)],
        by_hour=[HourChartItem(hour=h, **by_hour_dict[h]) for h in range(24)],
        by_day_of_week=[DayChartItem(day_of_week=d, **by_day_dict[d]) for d in range(7)],
        top_crash_types=top_crash_types,
        totals=totals,
    )


@router.get("/municipal-report", response_model=MunicipalReport)
def get_municipal_report(
    municipality: str = Query(..., min_length=2, max_length=100)
):
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    MODE() WITHIN GROUP (ORDER BY region) as region,
                    COUNT(*) as total_crashes,
                    COUNT(*) FILTER (WHERE is_fatal) as fatal_crashes,
                    COALESCE(SUM(injured), 0) as injured_total
                FROM crashes
                WHERE municipality ILIKE %s;
            """, (f"%{municipality.strip()}%",))
            muni_row = cur.fetchone()
            if not muni_row or muni_row[1] == 0:
                raise HTTPException(status_code=404, detail="Municipality not found in dataset")

            region, total_crashes, fatal_crashes, injured_total = muni_row

            cur.execute("""
                SELECT COALESCE(SUM(length_km), 0)
                FROM road_network_stats
                WHERE region ILIKE %s;
            """, (f"%{region}%",))
            nsi_row = cur.fetchone()
            road_length = float(nsi_row[0]) if nsi_row else 0.0

            cur.execute("""
                SELECT hour, COUNT(*)
                FROM crashes
                WHERE municipality ILIKE %s
                GROUP BY hour
                ORDER BY COUNT(*) DESC
                LIMIT 3;
            """, (f"%{municipality.strip()}%",))
            peak_hours = [r[0] for r in cur.fetchall()]

            cur.execute("""
                SELECT day_of_week, COUNT(*)
                FROM crashes
                WHERE municipality ILIKE %s
                GROUP BY day_of_week
                ORDER BY COUNT(*) DESC
                LIMIT 3;
            """, (f"%{municipality.strip()}%",))
            peak_days = [r[0] for r in cur.fetchall()]

            cur.execute("""
                SELECT
                    ROUND(AVG(lat)::numeric, 4) as lat,
                    ROUND(AVG(lon)::numeric, 4) as lon,
                    COUNT(*) as crash_count,
                    COUNT(*) FILTER (WHERE is_fatal) as fatal_count,
                    MODE() WITHIN GROUP (ORDER BY crash_type) as top_type
                FROM crashes
                WHERE municipality ILIKE %s
                GROUP BY ST_SnapToGrid(geom, 0.015)
                HAVING COUNT(*) >= 2
                ORDER BY crash_count DESC
                LIMIT 5;
            """, (f"%{municipality.strip()}%",))
            top_blackspots = [
                BlackspotZone(
                    lat=float(r[0]),
                    lon=float(r[1]),
                    crash_count=r[2],
                    fatal_count=r[3],
                    label=f"{r[4]} ({r[2]} инцидента)",
                )
                for r in cur.fetchall()
            ]

    recommendations = [
        f"Организиране на смесени пътни патрули в пиковите часове {', '.join(f'{h:02d}:00' for h in peak_hours)}.",
        "Преглед на видимостта на пешеходните пътеки и монтиране на насочено LED осветление.",
        "Приоритизиране на инженерингови мерки (кръгови кръстовища, скоростни неравности) в установените топ 5 рискови зони.",
        "Кампания за пътна безопасност насочена към водачи и пешеходци през уикендите.",
    ]

    return MunicipalReport(
        municipality=municipality,
        region=region or "България",
        total_crashes=total_crashes,
        total_fatal=fatal_crashes,
        total_injured=injured_total,
        regional_road_length_km=road_length,
        peak_hours=peak_hours,
        peak_days=peak_days,
        top_blackspots=top_blackspots,
        recommendations=recommendations,
    )
