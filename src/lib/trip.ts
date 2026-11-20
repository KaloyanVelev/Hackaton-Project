import type { LineString } from "geojson";

export type TripCoordinate = [longitude: number, latitude: number];
export type TripCity = [id: number, bg: string, en: string, longitude: number, latitude: number];

export interface TripRequest {
  start: number;
  end: number;
  hour: number;
  weekday: number;
  month: number;
  points: number;
}

export interface TripPoint {
  number: number;
  longitude: number;
  latitude: number;
  distanceKm: number;
  majorCrashes: number;
  probability: number;
}

export interface TripResult {
  route: LineString;
  distanceKm: number;
  durationMinutes: number;
  maximum: number;
  average: number;
  points: TripPoint[];
}

export const tripPrototype = {
  minimumPoints: 2,
  maximumPoints: 25,
  defaultPoints: 2,
  radiusKm: 30,
  hourWindow: 2,
  monthWindow: 1,
  nationalWeight: 20,
};
