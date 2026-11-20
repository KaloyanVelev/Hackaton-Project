import json
import time
from pathlib import Path

import gradio as gr
import numpy as np
import pandas as pd
import requests
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

# ==========================================
# 1. Зареждане на данните и обучение на модела
# ==========================================
CSV_PATH = Path("ptp.csv")
CACHE_FILE = Path("osm_geocode_cache.json")

df_raw = pd.read_csv(CSV_PATH)

region_coords = (
    df_raw.dropna(subset=["region", "latitude", "longitude"])
    .groupby("region")[["latitude", "longitude"]]
    .mean()
)

df = df_raw.drop_duplicates().copy()
df["fatal"] = (df["diedcount"] > 0).astype(int)
df = df[df["ismajor"] == 1].copy()
df["in_settlement"] = (
    df["ptp_place"]
    .astype(str)
    .str.strip()
    .str.lower()
    .map({"в населено място": 1, "извън населено място": 0})
)

X = df[["in_settlement", "hourofday", "dayofweek", "month"]].join(
    pd.get_dummies(df["region"], prefix="region", dtype=int)
)
y = df["fatal"]

mask = X.notna().all(axis=1) & y.notna()
X = X.loc[mask].reset_index(drop=True)
y = y.loc[mask].reset_index(drop=True)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

model = RandomForestClassifier(
    n_estimators=300, min_samples_leaf=30, random_state=42, n_jobs=-1
)
model.fit(X_train, y_train)

MODEL_AUC = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])

# ==========================================
# 2. Геокодиране през OpenStreetMap + кеш
# ==========================================
def load_cache():
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}


def save_cache(cache):
    CACHE_FILE.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8"
    )


_geocode_cache = load_cache()


def geocode_osm(place_text, countrycodes="bg"):
    key = (place_text or "").strip().lower()
    if not key:
        raise ValueError("Моля, въведете текст за начало или дестинация.")

    if key in _geocode_cache:
        lat, lon = _geocode_cache[key]
        return float(lat), float(lon)

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": place_text.strip(),
        "format": "json",
        "limit": 1,
        "countrycodes": countrycodes,
    }
    headers = {
        "User-Agent": "HackathonPTPAnalyzer/1.0 (student-hackathon-demo)"
    }

    resp = requests.get(url, params=params, headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if not data:
        raise ValueError(f"OpenStreetMap не намери координати за: '{place_text}'")

    lat = float(data[0]["lat"])
    lon = float(data[0]["lon"])

    _geocode_cache[key] = [lat, lon]
    save_cache(_geocode_cache)
    time.sleep(1.1)
    return lat, lon


def nearest_region(lat, lon):
    dists = np.hypot(
        region_coords["latitude"] - lat, region_coords["longitude"] - lon
    )
    return dists.idxmin()


def score_route(
    origin_text,
    dest_text,
    hourofday=23,
    dayofweek=4,
    month=8,
    n_points=10,
):
    lat1, lon1 = geocode_osm(origin_text)
    lat2, lon2 = geocode_osm(dest_text)

    n_points = int(n_points)
    lats = np.linspace(lat1, lat2, n_points)
    lons = np.linspace(lon1, lon2, n_points)

    rows = []
    for i, (lat, lon) in enumerate(zip(lats, lons)):
        reg = nearest_region(lat, lon)
        in_settle = 1 if i in (0, n_points - 1) else 0

        row = {col: 0 for col in X_train.columns}
        if "in_settlement" in row:
            row["in_settlement"] = in_settle
        if "hourofday" in row:
            row["hourofday"] = int(hourofday)
        if "dayofweek" in row:
            row["dayofweek"] = int(dayofweek)
        if "month" in row:
            row["month"] = int(month)

        reg_col = f"region_{reg}"
        if reg_col in row:
            row[reg_col] = 1

        rows.append((i, reg, lat, lon, row))

    X_route = pd.DataFrame([r[4] for r in rows])[X_train.columns]
    probs = model.predict_proba(X_route)[:, 1]

    segments = pd.DataFrame(
        {
            "стъпка": [r[0] for r in rows],
            "област": [r[1] for r in rows],
            "lat": [round(r[2], 5) for r in rows],
            "lon": [round(r[3], 5) for r in rows],
            "вероятност_фатално": (probs * 100).round(2),
        }
    )
    return float(probs.max()), float(probs.mean()), segments


# ==========================================
# 3. Gradio интерфейс
# ==========================================
DAYS_MAP = {
    "Понеделник (0)": 0,
    "Вторник (1)": 1,
    "Сряда (2)": 2,
    "Четвъртък (3)": 3,
    "Петък (4)": 4,
    "Събота (5)": 5,
    "Неделя (6)": 6,
}


def run_gradio_route(origin_text, dest_text, hourofday, day_label, month, n_points):
    try:
        max_p, mean_p, segments = score_route(
            origin_text=origin_text,
            dest_text=dest_text,
            hourofday=hourofday,
            dayofweek=DAYS_MAP[day_label],
            month=month,
            n_points=n_points,
        )
        summary = (
            f"**Маршрут:** {origin_text.strip()} → {dest_text.strip()}\n\n"
            f"- **Максимална вероятност за фатално ПТП по участък:** **{max_p:.1%}**\n"
            f"- **Средна вероятност за фатално ПТП по маршрута:** **{mean_p:.1%}**\n"
            f"- *Оценката показва дял/вероятност за фаталност при възникнало тежко ПТП (`ismajor=1`), не обща честота на трафика.*"
        )
        return summary, segments
    except Exception as e:
        empty_df = pd.DataFrame(
            columns=["стъпка", "област", "lat", "lon", "вероятност_фатално"]
        )
        return f"**Грешка:** {e}", empty_df


with gr.Blocks(title="Анализ на риск при ПТП по маршрут") as demo:
    gr.Markdown(
        f"# Оценка на риска от фатално ПТП по маршрут\n"
        f"Модел: `RandomForestClassifier` (тестов ROC-AUC: **{MODEL_AUC:.3f}**) + OpenStreetMap Nominatim геокодиране."
    )

    with gr.Row():
        origin_in = gr.Textbox(label="Начална точка", value="София", placeholder="Напр. София")
        dest_in = gr.Textbox(label="Крайна точка", value="Пловдив", placeholder="Напр. Пловдив")

    with gr.Row():
        hour_in = gr.Slider(0, 23, value=2, step=1, label="Час от денонощието (0–23)")
        day_in = gr.Dropdown(
            choices=list(DAYS_MAP.keys()),
            value="Неделя (6)",
            label="Ден от седмицата",
        )
        month_in = gr.Slider(1, 12, value=8, step=1, label="Месец (1–12)")
        points_in = gr.Slider(4, 25, value=10, step=1, label="Брой точки по маршрута")

    run_btn = gr.Button("Изчисли риска", variant="primary")

    summary_out = gr.Markdown()
    table_out = gr.Dataframe(label="Риск по точки/области (%)", interactive=False)

    gr.Examples(
        examples=[
            ["София", "Пловдив", 2, "Неделя (6)", 8, 10],
            ["Габрово", "Русе", 2, "Неделя (6)", 8, 10],
            ["София", "Сандански", 2, "Неделя (6)", 8, 10],
            ["Варна", "Бургас", 14, "Сряда (2)", 7, 10],
        ],
        inputs=[origin_in, dest_in, hour_in, day_in, month_in, points_in],
    )

    run_btn.click(
        fn=run_gradio_route,
        inputs=[origin_in, dest_in, hour_in, day_in, month_in, points_in],
        outputs=[summary_out, table_out],
    )

demo.launch(share=True)