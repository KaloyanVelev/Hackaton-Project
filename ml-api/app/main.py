from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import init_pool, close_pool
from app.ml.predictor import get_model_artifact
from app.routers import health, crashes, analytics, risk, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_pool()
    get_model_artifact()
    yield
    close_pool()


app = FastAPI(
    title="StreetAware API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(crashes.router)
app.include_router(analytics.router)
app.include_router(risk.router)
app.include_router(chat.router)
