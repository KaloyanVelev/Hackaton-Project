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
