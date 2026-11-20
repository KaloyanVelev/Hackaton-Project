import httpx
from fastapi import APIRouter
from app.config import settings
from app.db import get_db_connection
from app.ml.predictor import get_model_artifact
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def get_health():
    db_connected = False
    crash_count = 0
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM crashes;")
                row = cur.fetchone()
                if row is not None:
                    crash_count = row[0]
                    db_connected = True
    except Exception:
        db_connected = False

    model_loaded = get_model_artifact() is not None

    llm_reachable = False
    try:
        r = httpx.get(f"{settings.LLM_BASE_URL.rstrip('/')}/models", timeout=1.0)
        if r.status_code < 400:
            llm_reachable = True
    except Exception:
        llm_reachable = False

    return HealthResponse(
        status="ok" if db_connected else "degraded",
        db_connected=db_connected,
        crash_count=crash_count,
        model_loaded=model_loaded,
        llm_reachable=llm_reachable,
        llm_model=settings.LLM_MODEL,
    )
