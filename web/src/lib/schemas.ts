import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.string(),
  db_connected: z.boolean(),
  crash_count: z.number(),
  model_loaded: z.boolean(),
  llm_reachable: z.boolean(),
  llm_model: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const MunicipalityItemSchema = z.object({
  municipality: z.string(),
  region: z.string(),
  total_crashes: z.number(),
  fatal_crashes: z.number(),
  injured_total: z.number(),
  center_lat: z.number(),
  center_lon: z.number(),
});
export type MunicipalityItem = z.infer<typeof MunicipalityItemSchema>;

export const CrashQueryParamsSchema = z.object({
  min_lat: z.coerce.number().min(41.0).max(44.5).default(41.2),
  max_lat: z.coerce.number().min(41.0).max(44.5).default(44.3),
  min_lon: z.coerce.number().min(22.0).max(29.0).default(22.3),
  max_lon: z.coerce.number().min(22.0).max(29.0).default(28.7),
  municipality: z.string().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  day_of_week: z.coerce.number().min(0).max(6).optional(),
  hour_from: z.coerce.number().min(0).max(23).optional(),
  hour_to: z.coerce.number().min(0).max(23).optional(),
  fatal_only: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  crash_type: z.string().optional(),
  limit: z.coerce.number().min(1).max(25000).default(5000),
});
export type CrashQueryParams = z.infer<typeof CrashQueryParamsSchema>;

export const CrashFeaturePropertiesSchema = z.object({
  id: z.number(),
  occurred_at: z.string(),
  municipality: z.string(),
  crash_type: z.string(),
  killed: z.number(),
  injured: z.number(),
  is_fatal: z.boolean(),
});

export const CrashFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: CrashFeaturePropertiesSchema,
});

export const CrashFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(CrashFeatureSchema),
});
export type CrashFeatureCollection = z.infer<typeof CrashFeatureCollectionSchema>;

export const CrashDetailSchema = z.object({
  id: z.number(),
  source_hash: z.string(),
  occurred_at: z.string(),
  year: z.number(),
  month: z.number(),
  day_of_week: z.number(),
  hour: z.number(),
  region: z.string(),
  municipality: z.string(),
  settlement: z.string().nullable(),
  road_class: z.string().nullable(),
  crash_type: z.string(),
  killed: z.number(),
  injured: z.number(),
  is_fatal: z.boolean(),
  lat: z.number(),
  lon: z.number(),
  nearby_500m_count: z.number(),
  raw_payload: z.record(z.any()),
});
export type CrashDetail = z.infer<typeof CrashDetailSchema>;

export const HotspotsQueryParamsSchema = z.object({
  municipality: z.string().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  hour_from: z.coerce.number().min(0).max(23).optional(),
  hour_to: z.coerce.number().min(0).max(23).optional(),
  fatal_only: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
  grid_deg: z.coerce.number().min(0.005).max(0.05).default(0.015),
  limit: z.coerce.number().min(1).max(100).default(25),
});
export type HotspotsQueryParams = z.infer<typeof HotspotsQueryParamsSchema>;

export const HotspotItemSchema = z.object({
  center_lat: z.number(),
  center_lon: z.number(),
  crash_count: z.number(),
  fatal_count: z.number(),
  injured_count: z.number(),
  peak_hour: z.number(),
  top_crash_type: z.string(),
  municipality: z.string(),
});
export type HotspotItem = z.infer<typeof HotspotItemSchema>;

export const ChartsQueryParamsSchema = z.object({
  municipality: z.string().optional(),
  year: z.coerce.number().min(2015).max(2030).optional(),
  fatal_only: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(false),
});
export type ChartsQueryParams = z.infer<typeof ChartsQueryParamsSchema>;

export const ChartDataSchema = z.object({
  by_month: z.array(z.object({
    month: z.number(),
    total: z.number(),
    fatal: z.number(),
    injured: z.number(),
  })),
  by_hour: z.array(z.object({
    hour: z.number(),
    total: z.number(),
    fatal: z.number(),
    injured: z.number(),
  })),
  by_day_of_week: z.array(z.object({
    day_of_week: z.number(),
    total: z.number(),
    fatal: z.number(),
  })),
  top_crash_types: z.array(z.object({
    crash_type: z.string(),
    count: z.number(),
  })),
  totals: z.object({
    total_crashes: z.number(),
    total_fatal: z.number(),
    total_killed: z.number(),
    total_injured: z.number(),
  }),
});
export type ChartData = z.infer<typeof ChartDataSchema>;

export const MunicipalReportParamsSchema = z.object({
  municipality: z.string().min(2).max(100),
});

export const MunicipalReportSchema = z.object({
  municipality: z.string(),
  region: z.string(),
  total_crashes: z.number(),
  total_fatal: z.number(),
  total_injured: z.number(),
  regional_road_length_km: z.number(),
  peak_hours: z.array(z.number()),
  peak_days: z.array(z.number()),
  top_blackspots: z.array(z.object({
    lat: z.number(),
    lon: z.number(),
    crash_count: z.number(),
    fatal_count: z.number(),
    label: z.string(),
  })),
  recommendations: z.array(z.string()),
});
export type MunicipalReport = z.infer<typeof MunicipalReportSchema>;

export const PredictRiskRequestSchema = z.object({
  municipality: z.string().min(1).max(100),
  day_of_week: z.number().min(0).max(6),
  hour: z.number().min(0).max(23),
  month: z.number().min(1).max(12),
  road_class: z.string().max(50).optional().nullable(),
});
export type PredictRiskRequest = z.infer<typeof PredictRiskRequestSchema>;

export const PredictRiskResponseSchema = z.object({
  municipality: z.string(),
  day_of_week: z.number(),
  hour: z.number(),
  month: z.number(),
  road_class: z.string(),
  fatal_risk_pct: z.number(),
  national_baseline_pct: z.number(),
  relative_risk_multiplier: z.number(),
  risk_tier: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
  historical_sample_size: z.number(),
  top_factors: z.array(z.string()),
  driver_warning: z.string(),
  municipal_measures: z.array(z.string()),
});
export type PredictRiskResponse = z.infer<typeof PredictRiskResponseSchema>;

export const TripRiskRequestSchema = z.object({
  origin_name: z.string().max(100).optional().nullable(),
  dest_name: z.string().max(100).optional().nullable(),
  origin_lat: z.number().min(41.0).max(44.5),
  origin_lon: z.number().min(22.0).max(29.0),
  dest_lat: z.number().min(41.0).max(44.5),
  dest_lon: z.number().min(22.0).max(29.0),
  day_of_week: z.number().min(0).max(6),
  departure_hour: z.number().min(0).max(23),
  buffer_meters: z.number().min(200).max(10000).default(1500),
});
export type TripRiskRequest = z.infer<typeof TripRiskRequestSchema>;

export const TripRiskResponseSchema = z.object({
  route_geojson: z.record(z.any()),
  used_osrm: z.boolean(),
  distance_km: z.number(),
  total_corridor_crashes: z.number(),
  window_crashes: z.number(),
  fatal_crashes: z.number(),
  risk_tier: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
  hotspot_segments: z.array(z.object({
    lat: z.number(),
    lon: z.number(),
    crash_count: z.number(),
    fatal_count: z.number(),
    description: z.string(),
  })),
  driver_warnings: z.array(z.string()),
});
export type TripRiskResponse = z.infer<typeof TripRiskResponseSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(2).max(1000),
  municipality: z.string().max(100).optional().nullable(),
  history: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().min(1).max(2000),
  })).max(6).optional().default([]),
  llm_base_url: z.string().optional().nullable(),
  llm_model: z.string().optional().nullable(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  llm_available: z.boolean(),
  answer: z.string(),
  tool_calls_used: z.array(z.string()),
  data_citations: z.array(z.record(z.any())),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
