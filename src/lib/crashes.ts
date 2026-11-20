import type { FeatureCollection, Point } from "geojson";

export const severities = ["none", "injury", "fatal", "unknown"] as const;
export type Severity = (typeof severities)[number];
export type Bounds = [west: number, south: number, east: number, north: number];

export interface Snapshot {
  id: string;
  sourceCount: number;
  mappedCount: number;
  missingCoordinates: number;
  invalidCoordinates: number;
  outsideCountry: number;
  exactRepeats: number;
  firstAt: string | null;
  lastAt: string | null;
}

export interface Crash {
  id: number;
  occurredAt: string | null;
  severity: Severity;
  injured: number | null;
  deaths: number | null;
  region: string | null;
  municipality: string | null;
  location: string | null;
  crashType: string | null;
  longitude: number;
  latitude: number;
}

export interface CrashPage {
  crashes: Crash[];
  next: number | null;
  total?: number;
}

export interface MetricCount {
  count: number;
  deaths: number;
  injured: number;
}

export interface HourlyStat extends MetricCount {
  hour: number;
}

export interface CrashTypeStat extends MetricCount {
  type: string;
}

export interface RegionStat extends MetricCount {
  region: string;
}

export interface DayOfWeekStat extends MetricCount {
  day: number;
}

export interface UrbanRuralStat extends MetricCount {
  place: string;
}

export interface MonthlyStat extends MetricCount {
  month: number;
}

export interface RoadFeatureStat extends MetricCount {
  feature: string;
}

export interface AggregatedStats {
  totals: {
    totalCrashes: number;
    totalDeaths: number;
    totalInjured: number;
  };
  hourly: HourlyStat[];
  crashTypes: CrashTypeStat[];
  regions: RegionStat[];
  dayOfWeek: DayOfWeekStat[];
  urbanRural: UrbanRuralStat[];
  monthly: MonthlyStat[];
  roadFeatures: RoadFeatureStat[];
}

export function validateStatsPayload(data: unknown): data is AggregatedStats {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<AggregatedStats>;
  return Boolean(
    d.totals &&
    typeof d.totals.totalCrashes === "number" &&
    Array.isArray(d.hourly) &&
    Array.isArray(d.crashTypes) &&
    Array.isArray(d.regions) &&
    Array.isArray(d.dayOfWeek) &&
    Array.isArray(d.urbanRural) &&
    Array.isArray(d.monthly) &&
    Array.isArray(d.roadFeatures)
  );
}

export function formatStatsSummary(stats: AggregatedStats) {
  const peakHourItem = [...stats.hourly].sort((a, b) => b.count - a.count)[0];
  const deadliestTypeItem = [...stats.crashTypes].sort((a, b) => b.deaths - a.deaths)[0];
  const deadliestRegionItem = [...stats.regions].sort((a, b) => b.deaths - a.deaths)[0];
  const deadliestDayItem = [...stats.dayOfWeek].sort((a, b) => b.deaths - a.deaths)[0];
  const peakMonthItem = [...stats.monthly].sort((a, b) => b.count - a.count)[0];
  const topFeatureItem = [...stats.roadFeatures].sort((a, b) => b.count - a.count)[0];

  return {
    peakHour: peakHourItem ? peakHourItem.hour : 17,
    deadliestCrashType: deadliestTypeItem ? deadliestTypeItem.type : "блъскане на пешеходец",
    deadliestRegion: deadliestRegionItem ? deadliestRegionItem.region : "ПЛОВДИВ",
    deadliestDay: deadliestDayItem ? deadliestDayItem.day : 6,
    peakMonth: peakMonthItem ? peakMonthItem.month : 7,
    topFeature: topFeatureItem ? topFeatureItem.feature : "пешеходна пътека",
  };
}


export type CrashPoints = FeatureCollection<Point, { severity: Severity; crashId: number }>;

export function deriveSeverity(deaths: number | null, injured: number | null): Severity {
  if (deaths !== null && deaths > 0) return "fatal";
  if (deaths === 0 && injured !== null) return injured > 0 ? "injury" : "none";
  return "unknown";
}

export function isSnapshotId(value: string) {
  return /^[\da-f]{64}$/.test(value);
}

export function parseRowId(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return id <= 2_147_483_647 ? id : null;
}

export function parseBounds(value: string): Bounds | null {
  const fields = value.split(",");
  if (fields.length !== 4 || fields.some((item) => !item.trim())) return null;
  const [west, south, east, north] = fields.map(Number);
  if (![west, south, east, north].every(Number.isFinite)) return null;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west > east || south > north) {
    return null;
  }
  return [west, south, east, north];
}
