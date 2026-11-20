from typing import Any, Literal
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    db_connected: bool
    crash_count: int
    model_loaded: bool
    llm_reachable: bool
    llm_model: str


class MunicipalityItem(BaseModel):
    municipality: str
    region: str
    total_crashes: int
    fatal_crashes: int
    injured_total: int
    center_lat: float
    center_lon: float


class CrashFeatureGeometry(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: list[float]


class CrashFeatureProperties(BaseModel):
    id: int
    occurred_at: str
    municipality: str
    crash_type: str
    killed: int
    injured: int
    is_fatal: bool


class CrashFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: CrashFeatureGeometry
    properties: CrashFeatureProperties


class CrashFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[CrashFeature]


class CrashDetail(BaseModel):
    id: int
    source_hash: str
    occurred_at: str
    year: int
    month: int
    day_of_week: int
    hour: int
    region: str
    municipality: str
    settlement: str | None
    road_class: str | None
    crash_type: str
    killed: int
    injured: int
    is_fatal: bool
    lat: float
    lon: float
    nearby_500m_count: int
    raw_payload: dict[str, Any]


class HotspotItem(BaseModel):
    center_lat: float
    center_lon: float
    crash_count: int
    fatal_count: int
    injured_count: int
    peak_hour: int
    top_crash_type: str
    municipality: str


class MonthChartItem(BaseModel):
    month: int
    total: int
    fatal: int
    injured: int


class HourChartItem(BaseModel):
    hour: int
    total: int
    fatal: int
    injured: int


class DayChartItem(BaseModel):
    day_of_week: int
    total: int
    fatal: int


class CrashTypeChartItem(BaseModel):
    crash_type: str
    count: int


class ChartTotals(BaseModel):
    total_crashes: int
    total_fatal: int
    total_killed: int
    total_injured: int


class ChartData(BaseModel):
    by_month: list[MonthChartItem]
    by_hour: list[HourChartItem]
    by_day_of_week: list[DayChartItem]
    top_crash_types: list[CrashTypeChartItem]
    totals: ChartTotals


class BlackspotZone(BaseModel):
    lat: float
    lon: float
    crash_count: int
    fatal_count: int
    label: str


class MunicipalReport(BaseModel):
    municipality: str
    region: str
    total_crashes: int
    total_fatal: int
    total_injured: int
    regional_road_length_km: float
    peak_hours: list[int]
    peak_days: list[int]
    top_blackspots: list[BlackspotZone]
    recommendations: list[str]


class PredictRiskRequest(BaseModel):
    municipality: str = Field(..., min_length=1, max_length=100)
    day_of_week: int = Field(..., ge=0, le=6)
    hour: int = Field(..., ge=0, le=23)
    month: int = Field(..., ge=1, le=12)
    road_class: str | None = Field(None, max_length=50)


class PredictRiskResponse(BaseModel):
    municipality: str
    day_of_week: int
    hour: int
    month: int
    road_class: str
    fatal_risk_pct: float
    national_baseline_pct: float
    relative_risk_multiplier: float
    risk_tier: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    historical_sample_size: int
    top_factors: list[str]
    driver_warning: str
    municipal_measures: list[str]


class TripRiskRequest(BaseModel):
    origin_name: str | None = Field(None, max_length=100)
    dest_name: str | None = Field(None, max_length=100)
    origin_lat: float = Field(..., ge=41.0, le=44.5)
    origin_lon: float = Field(..., ge=22.0, le=29.0)
    dest_lat: float = Field(..., ge=41.0, le=44.5)
    dest_lon: float = Field(..., ge=22.0, le=29.0)
    day_of_week: int = Field(..., ge=0, le=6)
    departure_hour: int = Field(..., ge=0, le=23)
    buffer_meters: int = Field(1500, ge=200, le=10000)


class TripHotspotSegment(BaseModel):
    lat: float
    lon: float
    crash_count: int
    fatal_count: int
    description: str


class TripRiskResponse(BaseModel):
    route_geojson: dict[str, Any]
    used_osrm: bool
    distance_km: float
    total_corridor_crashes: int
    window_crashes: int
    fatal_crashes: int
    risk_tier: Literal["LOW", "MODERATE", "HIGH", "CRITICAL"]
    hotspot_segments: list[TripHotspotSegment]
    driver_warnings: list[str]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=1000)
    municipality: str | None = Field(None, max_length=100)
    history: list[ChatMessage] = Field(default_factory=list, max_length=6)
    llm_base_url: str | None = None
    llm_model: str | None = None


class ChatResponse(BaseModel):
    llm_available: bool
    answer: str
    tool_calls_used: list[str]
    data_citations: list[dict[str, Any]]
