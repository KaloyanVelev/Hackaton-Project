import { databaseUnavailable, problem } from "@/lib/http";
import { estimateTripPoints } from "@/lib/trip-queries";
import { getRoadRoute, parseTripRequest, RoutingError } from "@/lib/trip-route";
import type { TripResult } from "@/lib/trip";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const input = parseTripRequest(await request.json().catch(() => null));
  if (!input) return problem(400, "invalidTrip");

  try {
    const route = await getRoadRoute(input.origin, input.destination);
    const points = await estimateTripPoints(route.geometry, input);
    if (!points.length) return problem(422, "noEvidence");

    const result: TripResult = {
      route: route.geometry,
      distanceKm: route.distance / 1_000,
      durationMinutes: route.duration / 60,
      maximum: Math.max(...points.map(({ probability }) => probability)),
      average: points.reduce((sum, { probability }) => sum + probability, 0) / points.length,
      points,
    };
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RoutingError) {
      return problem(error.code === "noRoute" ? 422 : error.code === "routeBusy" ? 429 : 502, error.code);
    }
    return databaseUnavailable(error);
  }
}
