import os
import math
import joblib
import numpy as np
import pandas as pd
import psycopg
from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OrdinalEncoder
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss
from app.config import settings


def fetch_training_data() -> tuple[pd.DataFrame, dict, dict, float]:
    with psycopg.connect(settings.DATABASE_URL) as conn:
        df = pd.read_sql("""
            SELECT municipality, region, month, day_of_week, hour, COALESCE(road_class, 'Общински път') as road_class, is_fatal
            FROM crashes;
        """, conn)

        nsi_df = pd.read_sql("""
            SELECT region, road_class, length_km
            FROM road_network_stats;
        """, conn)

    muni_stats = df.groupby("municipality").agg(
        total_crashes=("is_fatal", "count"),
        fatal_crashes=("is_fatal", "sum"),
    ).to_dict("index")

    nsi_stats = nsi_df.set_index(["region", "road_class"])["length_km"].to_dict()

    national_baseline_pct = float(df["is_fatal"].mean() * 100.0)

    return df, muni_stats, nsi_stats, national_baseline_pct


def build_features(df: pd.DataFrame, muni_stats: dict, nsi_stats: dict) -> pd.DataFrame:
    X = pd.DataFrame()
    X["municipality"] = df["municipality"].astype(str)
    X["region"] = df["region"].astype(str)
    X["road_class"] = df["road_class"].astype(str)
    X["month"] = df["month"].astype(int)
    X["day_of_week"] = df["day_of_week"].astype(int)
    X["hour"] = df["hour"].astype(int)

    X["hour_sin"] = np.sin(2 * np.pi * X["hour"] / 24.0)
    X["hour_cos"] = np.cos(2 * np.pi * X["hour"] / 24.0)
    X["month_sin"] = np.sin(2 * np.pi * X["month"] / 12.0)
    X["month_cos"] = np.cos(2 * np.pi * X["month"] / 12.0)

    X["is_weekend"] = X["day_of_week"].isin([4, 5, 6]).astype(int)
    X["is_night"] = ((X["hour"] >= 21) | (X["hour"] <= 5)).astype(int)

    X["muni_total_crashes"] = X["municipality"].map(lambda m: muni_stats.get(m, {}).get("total_crashes", 1))

    def get_nsi(row):
        return nsi_stats.get((row["region"], row["road_class"]), 100.0)

    X["road_length_km"] = X.apply(get_nsi, axis=1)

    return X


def train():
    df, muni_stats, nsi_stats, national_baseline_pct = fetch_training_data()
    if df.empty:
        raise RuntimeError("No crash data available for training.")

    X = build_features(df, muni_stats, nsi_stats)
    y = df["is_fatal"].astype(int)

    cat_cols = ["municipality", "region", "road_class"]
    num_cols = [
        "month", "day_of_week", "hour",
        "hour_sin", "hour_cos", "month_sin", "month_cos",
        "is_weekend", "is_night", "muni_total_crashes", "road_length_km"
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1), cat_cols),
            ("num", "passthrough", num_cols),
        ]
    )

    base_model = HistGradientBoostingClassifier(
        class_weight="balanced",
        random_state=42,
        max_iter=100,
        min_samples_leaf=10,
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", base_model)
    ])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline.fit(X_train, y_train)

    calibrated_model = CalibratedClassifierCV(
        estimator=pipeline,
        method="sigmoid",
        cv=3
    )
    calibrated_model.fit(X_train, y_train)

    y_pred_proba = calibrated_model.predict_proba(X_test)[:, 1]

    roc_auc = roc_auc_score(y_test, y_pred_proba)
    pr_auc = average_precision_score(y_test, y_pred_proba)
    brier = brier_score_loss(y_test, y_pred_proba)

    print("==========================================")
    print("Fatal Risk ML Model Training Completed")
    print(f"Total Samples: {len(df)}")
    print(f"National Baseline Fatal Rate: {national_baseline_pct:.2f}%")
    print(f"ROC-AUC: {roc_auc:.4f}")
    print(f"PR-AUC: {pr_auc:.4f}")
    print(f"Brier Score: {brier:.4f}")
    print("==========================================")

    artifact_payload = {
        "model": calibrated_model,
        "muni_stats": muni_stats,
        "nsi_stats": nsi_stats,
        "national_baseline_pct": national_baseline_pct,
        "metrics": {
            "roc_auc": float(roc_auc),
            "pr_auc": float(pr_auc),
            "brier_score": float(brier),
            "sample_count": len(df),
        }
    }

    target_dirs = ["artifacts", "/app/artifacts", "ml-api/artifacts"]
    saved = False
    for t_dir in target_dirs:
        try:
            os.makedirs(t_dir, exist_ok=True)
            p = os.path.join(t_dir, "model.joblib")
            joblib.dump(artifact_payload, p)
            print(f"Saved model artifact to: {p}")
            saved = True
        except Exception:
            continue

    if not saved:
        p = "model.joblib"
        joblib.dump(artifact_payload, p)
        print(f"Saved model artifact to: {p}")


if __name__ == "__main__":
    train()
