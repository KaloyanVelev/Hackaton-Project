from typing import Literal
from app.db import get_db_connection
from app.ml.predictor import predict_fatal_risk


def get_municipality_summary(municipality: str) -> dict:
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_fatal) as fatal,
                    COALESCE(SUM(injured), 0) as injured,
                    COALESCE(SUM(killed), 0) as killed,
                    MAX(region) as region
                FROM crashes
                WHERE municipality ILIKE %s;
            """, (f"%{municipality.strip()}%",))
            row = cur.fetchone()
            if not row or row[0] == 0:
                return {"error": f"Няма намерени данни за община '{municipality}'"}

            total, fatal, injured, killed, region = row

            cur.execute("""
                SELECT crash_type, COUNT(*)
                FROM crashes
                WHERE municipality ILIKE %s
                GROUP BY crash_type
                ORDER BY COUNT(*) DESC
                LIMIT 3;
            """, (f"%{municipality.strip()}%",))
            top_types = [{"type": r[0], "count": r[1]} for r in cur.fetchall()]

            cur.execute("""
                SELECT hour, COUNT(*)
                FROM crashes
                WHERE municipality ILIKE %s
                GROUP BY hour
                ORDER BY COUNT(*) DESC
                LIMIT 3;
            """, (f"%{municipality.strip()}%",))
            peak_hours = [{"hour": r[0], "count": r[1]} for r in cur.fetchall()]

            return {
                "municipality": municipality,
                "region": region,
                "total_crashes": total,
                "fatal_crashes": fatal,
                "total_killed": killed,
                "total_injured": injured,
                "top_crash_types": top_types,
                "peak_hours": peak_hours,
            }


def get_time_distribution(municipality: str | None = None, group_by: Literal["month", "hour", "day_of_week"] = "hour") -> dict:
    valid_groups = {"month": "month", "hour": "hour", "day_of_week": "day_of_week"}
    col = valid_groups.get(group_by, "hour")

    query = f"""
        SELECT {col}, COUNT(*), COUNT(*) FILTER (WHERE is_fatal)
        FROM crashes
    """
    params = []
    if municipality:
        query += " WHERE municipality ILIKE %s"
        params.append(f"%{municipality.strip()}%")

    query += f" GROUP BY {col} ORDER BY {col} ASC;"

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()

    return {
        "grouped_by": col,
        "municipality": municipality or "Всички общини",
        "distribution": [
            {"bucket": r[0], "total": r[1], "fatal": r[2]}
            for r in rows
        ]
    }


def predict_fatal_risk_tool(municipality: str, day_of_week: int, hour: int, month: int) -> dict:
    try:
        return predict_fatal_risk(
            municipality=municipality,
            day_of_week=day_of_week,
            hour=hour,
            month=month,
        )
    except Exception as e:
        return {"error": str(e)}


def get_top_hotspots(municipality: str | None = None, limit: int = 5) -> dict:
    query = """
        SELECT
            ROUND(AVG(lat)::numeric, 4) as center_lat,
            ROUND(AVG(lon)::numeric, 4) as center_lon,
            COUNT(*) as crash_count,
            COUNT(*) FILTER (WHERE is_fatal) as fatal_count,
            COALESCE(SUM(injured), 0) as injured_count,
            municipality
        FROM crashes
    """
    params = []
    if municipality:
        query += " WHERE municipality ILIKE %s"
        params.append(f"%{municipality.strip()}%")

    query += """
        GROUP BY ST_SnapToGrid(geom, 0.015), municipality
        HAVING COUNT(*) >= 2
        ORDER BY crash_count DESC
        LIMIT %s;
    """
    params.append(limit)

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()

    return {
        "municipality": municipality or "Всички",
        "hotspots": [
            {
                "lat": float(r[0]),
                "lon": float(r[1]),
                "crash_count": r[2],
                "fatal_count": r[3],
                "injured_count": r[4],
                "municipality": r[5],
            }
            for r in rows
        ]
    }


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_municipality_summary",
            "description": "Извлича обобщена статистика за ПТП, жертви, ранени и опасни часове за конкретна община.",
            "parameters": {
                "type": "object",
                "properties": {
                    "municipality": {"type": "string", "description": "Име на общината (напр. Столична, Пловдив, Варна, Габрово)"}
                },
                "required": ["municipality"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_time_distribution",
            "description": "Връща разпределението на катастрофите по часове (hour), месеци (month) или дни от седмицата (day_of_week).",
            "parameters": {
                "type": "object",
                "properties": {
                    "municipality": {"type": "string", "description": "Опционална община за филтриране"},
                    "group_by": {"type": "string", "enum": ["month", "hour", "day_of_week"], "description": "Поле за групиране"}
                },
                "required": ["group_by"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "predict_fatal_risk_tool",
            "description": "Изчислява прогнозния риск от фатален изход чрез калибриран ML модел за дадена община, ден, час и месец.",
            "parameters": {
                "type": "object",
                "properties": {
                    "municipality": {"type": "string", "description": "Име на общината"},
                    "day_of_week": {"type": "integer", "description": "Ден от седмицата (0=Понеделник..6=Неделя)"},
                    "hour": {"type": "integer", "description": "Час (0..23)"},
                    "month": {"type": "integer", "description": "Месец (1..12)"}
                },
                "required": ["municipality", "day_of_week", "hour", "month"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_top_hotspots",
            "description": "Връща локациите с най-висока концентрация на инциденти (черни точки).",
            "parameters": {
                "type": "object",
                "properties": {
                    "municipality": {"type": "string", "description": "Опционална община"},
                    "limit": {"type": "integer", "description": "Максимален брой горещи точки (по подразбиране 5)"}
                }
            }
        }
    }
]


def execute_tool(name: str, arguments: dict) -> dict:
    if name == "get_municipality_summary":
        return get_municipality_summary(arguments.get("municipality", ""))
    elif name == "get_time_distribution":
        return get_time_distribution(
            municipality=arguments.get("municipality"),
            group_by=arguments.get("group_by", "hour")
        )
    elif name == "predict_fatal_risk_tool":
        return predict_fatal_risk_tool(
            municipality=arguments.get("municipality", ""),
            day_of_week=int(arguments.get("day_of_week", 0)),
            hour=int(arguments.get("hour", 12)),
            month=int(arguments.get("month", 1)),
        )
    elif name == "get_top_hotspots":
        return get_top_hotspots(
            municipality=arguments.get("municipality"),
            limit=int(arguments.get("limit", 5))
        )
    return {"error": f"Непознат инструмент: {name}"}
