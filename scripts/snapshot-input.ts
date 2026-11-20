import { deriveSeverity, type Severity } from "../src/lib/crashes.ts";

export const columns = [
  "diedcount", "injuredcount", "participantcount", "crashtype", "ptp_place",
  "ptp_placecharacteristics", "ptp_roadclass", "year", "region", "hourofday",
  "dayofweek", "month", "latitude", "longitude", "municipality", "location",
  "day", "ismajor", "crashdatetime",
] as const;

type RawRow = Record<(typeof columns)[number], string | null>;

export interface ImportRow {
  row_no: number;
  raw: RawRow;
  occurred_at: string | null;
  deaths: number | null;
  injured: number | null;
  severity: Severity;
  region: string | null;
  municipality: string | null;
  location: string | null;
  crash_type: string | null;
  longitude: number | null;
  latitude: number | null;
  coordinate_status: "missing" | "invalid" | "valid";
}

function parseCount(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null;
  const count = Number(value);
  return count <= 2_147_483_647 ? count : null;
}

function parseCoordinate(value: string | null, limit: number): number | null {
  if (value === null || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return null;
  const coordinate = Number(value);
  return Math.abs(coordinate) <= limit ? coordinate : null;
}

function parseLocalTime(value: string | null): string | null {
  if (!value || !/^[1-9]\d{3}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null;
  const iso = value.replace(" ", "T") + ".000Z";
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) && date.toISOString() === iso ? value : null;
}

export function parseSnapshot(input: string) {
  const parsed: unknown = JSON.parse(input.replace(/^\uFEFF/, ""));
  if (!Array.isArray(parsed) || parsed.length < 2) {
    throw new Error("Expected a header row and at least one crash row.");
  }
  const [header, ...records] = parsed;
  if (
    !Array.isArray(header) || header.length !== columns.length ||
    new Set(header).size !== header.length || !columns.every((key) => header.includes(key))
  ) {
    throw new Error("The crash snapshot must contain the expected 19 unique column names.");
  }

  let exactRepeats = 0;
  const seen = new Set<string>();
  const rows = records.map((record, index): ImportRow => {
    const rowNumber = index + 1;
    if (
      !Array.isArray(record) || record.length !== header.length ||
      !record.every((value) => value === null || typeof value === "string")
    ) {
      throw new Error(`Crash row ${rowNumber} must have 19 strings or null values.`);
    }
    const signature = JSON.stringify(record);
    if (seen.has(signature)) exactRepeats += 1;
    seen.add(signature);

    const raw = Object.fromEntries(header.map((key, column) => [key, record[column]])) as RawRow;
    const deaths = parseCount(raw.diedcount);
    const injured = parseCount(raw.injuredcount);
    const latitude = parseCoordinate(raw.latitude, 90);
    const longitude = parseCoordinate(raw.longitude, 180);
    const missing = !raw.latitude?.trim() || !raw.longitude?.trim();
    const coordinateStatus = missing ? "missing" : latitude === null || longitude === null ? "invalid" : "valid";

    return {
      row_no: rowNumber,
      raw,
      occurred_at: parseLocalTime(raw.crashdatetime),
      deaths,
      injured,
      severity: deriveSeverity(deaths, injured),
      region: raw.region?.trim() || null,
      municipality: raw.municipality?.trim() || null,
      location: raw.location?.trim() || null,
      crash_type: raw.crashtype?.trim() || null,
      longitude,
      latitude,
      coordinate_status: coordinateStatus,
    };
  });
  return { rows, exactRepeats };
}
