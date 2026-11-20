import type { LineString } from "geojson";
import cityData from "../../public/maps/bg-trip-cities.json";
import { tripPrototype, type TripCoordinate, type TripCity, type TripRequest } from "./trip";

const cities = new Map((cityData as TripCity[]).map(([id, , , longitude, latitude]) =>
  [id, [longitude, latitude] as TripCoordinate]));

interface RoadRoute {
  geometry: LineString;
  distance: number;
  duration: number;
}

class RoutingError extends Error {
  constructor(readonly code: "routeUnavailable" | "noRoute" | "routeBusy") {
    super(code);
  }
}

export { RoutingError };

const cache = new Map<string, Promise<RoadRoute>>();
let nextRequest = 0;

export function parseTripRequest(value: unknown) {
  if (value === null || typeof value !== "object") return null;
  const { start, end, hour, weekday, month, points } = value as Partial<TripRequest>;
  const origin = start === undefined ? undefined : cities.get(start);
  const destination = end === undefined ? undefined : cities.get(end);
  const integerWithin = (n: unknown, min: number, max: number): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

  if (!origin || !destination || origin.join(",") === destination.join(",") ||
      !integerWithin(hour, 0, 23) || !integerWithin(weekday, 1, 7) || !integerWithin(month, 1, 12) ||
      !integerWithin(points, tripPrototype.minimumPoints, tripPrototype.maximumPoints)) return null;
  return { origin, destination, hour, weekday, month, points };
}

export function getRoadRoute(origin: TripCoordinate, destination: TripCoordinate) {
  const coordinates = `${origin.join(",")};${destination.join(",")}`;
  const existing = cache.get(coordinates);
  if (existing) return existing;

  const now = Date.now();
  const wait = Math.max(0, nextRequest - now);
  if (wait > 4_000) throw new RoutingError("routeBusy");
  nextRequest = now + wait + 1_100;

  const pending = fetchRoute(coordinates, wait).catch((error: unknown) => {
    if (cache.get(coordinates) === pending) cache.delete(coordinates);
    throw error;
  });
  const oldest = cache.keys().next().value;
  if (cache.size >= 64 && oldest) cache.delete(oldest);
  cache.set(coordinates, pending);
  return pending;
}

async function fetchRoute(coordinates: string, wait: number): Promise<RoadRoute> {
  if (wait) await new Promise<void>((resolve) => setTimeout(resolve, wait));
  const endpoint = process.env.TRIP_ROUTING_URL || "https://routing.openstreetmap.de/routed-car";
  const url = `${endpoint.replace(/\/$/, "")}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&generate_hints=false`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "StreetAware/0.1 (+https://github.com/KaloyanVelev/Hackaton-Project)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 429) throw new RoutingError("routeBusy");
    const { code, routes } = await response.json() as { code?: string; routes?: RoadRoute[] };
    if (code === "NoRoute" || code === "NoSegment") throw new RoutingError("noRoute");
    const route = routes?.[0];
    if (!response.ok || code !== "Ok" || !route || route.geometry?.type !== "LineString" ||
        !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 ||
        !Number.isFinite(route.distance) || route.distance <= 0 || !Number.isFinite(route.duration)) {
      throw new RoutingError("routeUnavailable");
    }
    return route;
  } catch (error) {
    if (error instanceof RoutingError) throw error;
    throw new RoutingError("routeUnavailable");
  }
}
