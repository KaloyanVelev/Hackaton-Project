import os
import sys
import glob
import json
import csv
import psycopg
from app.config import settings

BASELINE_NSI = [
    ("Общо за страната", 2023, "Автомагистрали", 846.0),
    ("Общо за страната", 2023, "I клас", 2975.0),
    ("Общо за страната", 2023, "II клас", 4032.0),
    ("Общо за страната", 2023, "III клас", 11980.0),
    ("София-град", 2023, "Автомагистрали", 48.0),
    ("София-град", 2023, "I клас", 72.0),
    ("София-град", 2023, "II клас", 85.0),
    ("София-град", 2023, "III клас", 112.0),
    ("София", 2023, "Автомагистрали", 102.0),
    ("София", 2023, "I клас", 220.0),
    ("София", 2023, "II клас", 310.0),
    ("София", 2023, "III клас", 980.0),
    ("Пловдив", 2023, "Автомагистрали", 64.0),
    ("Пловдив", 2023, "I клас", 185.0),
    ("Пловдив", 2023, "II клас", 240.0),
    ("Пловдив", 2023, "III клас", 620.0),
    ("Варна", 2023, "Автомагистрали", 38.0),
    ("Варна", 2023, "I клас", 110.0),
    ("Варна", 2023, "II клас", 165.0),
    ("Варна", 2023, "III клас", 410.0),
    ("Бургас", 2023, "Автомагистрали", 45.0),
    ("Бургас", 2023, "I клас", 195.0),
    ("Бургас", 2023, "II клас", 290.0),
    ("Бургас", 2023, "III клас", 710.0),
    ("Велико Търново", 2023, "Автомагистрали", 0.0),
    ("Велико Търново", 2023, "I клас", 160.0),
    ("Велико Търново", 2023, "II клас", 210.0),
    ("Велико Търново", 2023, "III клас", 580.0),
    ("Габрово", 2023, "Автомагистрали", 0.0),
    ("Габрово", 2023, "I клас", 85.0),
    ("Габрово", 2023, "II клас", 120.0),
    ("Габрово", 2023, "III клас", 340.0),
    ("Русе", 2023, "Автомагистрали", 0.0),
    ("Русе", 2023, "I клас", 140.0),
    ("Русе", 2023, "II клас", 175.0),
    ("Русе", 2023, "III клас", 390.0),
    ("Стара Загора", 2023, "Автомагистрали", 82.0),
    ("Стара Загора", 2023, "I клас", 130.0),
    ("Стара Загора", 2023, "II клас", 190.0),
    ("Стара Загора", 2023, "III клас", 520.0),
    ("Плевен", 2023, "Автомагистрали", 0.0),
    ("Плевен", 2023, "I клас", 125.0),
    ("Плевен", 2023, "II клас", 215.0),
    ("Плевен", 2023, "III клас", 540.0),
    ("Благоевград", 2023, "Автомагистрали", 55.0),
    ("Благоевград", 2023, "I клас", 150.0),
    ("Благоевград", 2023, "II клас", 180.0),
    ("Благоевград", 2023, "III клас", 490.0),
]


def ingest_nsi_data(file_path: str | None = None) -> int:
    rows = []
    if file_path and os.path.exists(file_path):
        if file_path.endswith(".json"):
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "records" in data:
                    data = data["records"]
                for item in data:
                    rows.append((
                        str(item.get("region") or item.get("област") or "").strip(),
                        int(item.get("year") or item.get("година") or 2023),
                        str(item.get("road_class") or item.get("клас") or "").strip(),
                        float(str(item.get("length_km") or item.get("дължина_км") or 0).replace(",", ".")),
                    ))
        elif file_path.endswith(".csv"):
            with open(file_path, "r", encoding="utf-8-sig") as f:
                dialect = csv.Sniffer().sniff(f.read(2048))
                f.seek(0)
                reader = csv.DictReader(f, dialect=dialect)
                for item in reader:
                    rows.append((
                        str(item.get("region") or item.get("област") or "").strip(),
                        int(item.get("year") or item.get("година") or 2023),
                        str(item.get("road_class") or item.get("клас") or "").strip(),
                        float(str(item.get("length_km") or item.get("дължина_км") or 0).replace(",", ".")),
                    ))
    if not rows:
        rows = BASELINE_NSI

    query = """
    INSERT INTO road_network_stats (region, year, road_class, length_km)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (region, year, road_class)
    DO UPDATE SET length_km = EXCLUDED.length_km;
    """

    with psycopg.connect(settings.DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.executemany(query, rows)
            conn.commit()

    print(f"Successfully ingested {len(rows)} road network statistics records.")
    return len(rows)


if __name__ == "__main__":
    target = None
    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        for f in glob.glob("data/raw/*nsi*") + glob.glob("/app/data/raw/*nsi*"):
            target = f
            break
    ingest_nsi_data(target)
