import os
import joblib
import numpy as np
import pandas as pd
from app.db import get_db_connection

_model_artifact = None


def get_model_artifact():
    global _model_artifact
    if _model_artifact is not None:
        return _model_artifact

    candidate_paths = [
        "artifacts/model.joblib",
        "/app/artifacts/model.joblib",
        "ml-api/artifacts/model.joblib",
        "../artifacts/model.joblib",
    ]
    for p in candidate_paths:
        if os.path.exists(p):
            _model_artifact = joblib.load(p)
            return _model_artifact

    return None


def predict_fatal_risk(
    municipality: str,
    day_of_week: int,
    hour: int,
    month: int,
    road_class: str | None = None,
) -> dict:
    artifact = get_model_artifact()
    if not artifact:
        raise RuntimeError("ML model artifact not found.")

    model = artifact["model"]
    muni_stats = artifact.get("muni_stats", {})
    nsi_stats = artifact.get("nsi_stats", {})
    national_baseline_pct = artifact.get("national_baseline_pct", 1.52)

    region = "Неизвестна област"
    historical_sample_size = 0
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT region, COUNT(*) FROM crashes
                WHERE municipality = %s
                GROUP BY region
                ORDER BY COUNT(*) DESC
                LIMIT 1;
            """, (municipality,))
            row = cur.fetchone()
            if row:
                region = row[0]

            h_from = max(0, hour - 1)
            h_to = min(23, hour + 1)
            cur.execute("""
                SELECT COUNT(*) FROM crashes
                WHERE municipality = %s AND day_of_week = %s AND hour BETWEEN %s AND %s;
            """, (municipality, day_of_week, h_from, h_to))
            sample_row = cur.fetchone()
            if sample_row:
                historical_sample_size = sample_row[0]

    chosen_road_class = road_class or "Общински път"

    hour_sin = np.sin(2 * np.pi * hour / 24.0)
    hour_cos = np.cos(2 * np.pi * hour / 24.0)
    month_sin = np.sin(2 * np.pi * month / 12.0)
    month_cos = np.cos(2 * np.pi * month / 12.0)
    is_weekend = int(day_of_week in [4, 5, 6])
    is_night = int(hour >= 21 or hour <= 5)
    muni_total_crashes = muni_stats.get(municipality, {}).get("total_crashes", 1)
    road_length_km = nsi_stats.get((region, chosen_road_class), 100.0)

    input_df = pd.DataFrame([{
        "municipality": municipality,
        "region": region,
        "road_class": chosen_road_class,
        "month": month,
        "day_of_week": day_of_week,
        "hour": hour,
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
        "month_sin": month_sin,
        "month_cos": month_cos,
        "is_weekend": is_weekend,
        "is_night": is_night,
        "muni_total_crashes": muni_total_crashes,
        "road_length_km": road_length_km,
    }])

    proba = float(model.predict_proba(input_df)[0][1])
    fatal_risk_pct = round(proba * 100.0, 2)
    multiplier = round(fatal_risk_pct / max(0.01, national_baseline_pct), 2)

    if multiplier < 1.0:
        tier = "LOW"
    elif multiplier <= 1.5:
        tier = "MODERATE"
    elif multiplier <= 2.2:
        tier = "HIGH"
    else:
        tier = "CRITICAL"

    top_factors = []
    if is_night:
        top_factors.append("Нощни часове с намалена видимост и по-висока средна скорост")
    if is_weekend:
        top_factors.append("Уикенд трафик с повишен дял на умора и рисково изпреварване")
    if chosen_road_class in ["Автомагистрали", "I клас"]:
        top_factors.append("Високоскоростен пътен клас с тежки кинетични последици при удар")
    if historical_sample_size > 15:
        top_factors.append(f"Висока концентрация на инциденти в общината ({historical_sample_size} в този времеви пояс)")
    if not top_factors:
        top_factors.append("Стандартен градски профил на движение")

    driver_warnings = {
        "LOW": "Поддържайте стандартна дистанция и контролирайте скоростта.",
        "MODERATE": "Повишено внимание на кръстовища и при мокра настилка в този часови диапазон.",
        "HIGH": "Висока опасност: Намалете скоростта с поне 15 км/ч под ограничението, следете за пешеходци и избягвайте изпреварвания.",
        "CRITICAL": "Критичен риск от тежки инциденти: Максимална концентрация, включени къси светлини, забрана за рискови маневри.",
    }

    municipal_measures = [
        f"Засилен полицейски контрол за скорост и алкохол/наркотици в часовия интервал {hour:02d}:00–{(hour+2)%24:02d}:00.",
        "Проверка и подобряване на уличното осветление и светлоотразителната маркировка.",
        "Монтаж на динамични знаци за ограничение на скоростта и изкуствени неравности преди пешеходни пътеки.",
        "Инспекция на пътната настилка за сцепление и отводняване в критичните участъци.",
    ]

    return {
        "municipality": municipality,
        "day_of_week": day_of_week,
        "hour": hour,
        "month": month,
        "road_class": chosen_road_class,
        "fatal_risk_pct": fatal_risk_pct,
        "national_baseline_pct": round(national_baseline_pct, 2),
        "relative_risk_multiplier": multiplier,
        "risk_tier": tier,
        "historical_sample_size": historical_sample_size,
        "top_factors": top_factors,
        "driver_warning": driver_warnings.get(tier, driver_warnings["MODERATE"]),
        "municipal_measures": municipal_measures,
    }
