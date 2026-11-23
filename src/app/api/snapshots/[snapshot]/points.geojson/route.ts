import { gunzipSync } from "node:zlib";
import { countActiveFilters, isSnapshotId, parseCrashFilters } from "@/lib/crashes";
import { databaseUnavailable, problem } from "@/lib/http";
import { getFilteredCrashPoints, getPointFeed, hasSnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ snapshot: string }> }) {
  const { snapshot } = await params;
  if (!isSnapshotId(snapshot)) return problem(404, "Snapshot not found.");

  try {
    const filters = parseCrashFilters(new URL(request.url).searchParams);
    if (countActiveFilters(filters) > 0) {
      if (!await hasSnapshot(snapshot)) return problem(404, "Snapshot not found.");
      const points = await getFilteredCrashPoints(snapshot, filters);
      return new Response(JSON.stringify(points), { headers: {
        "Content-Type": "application/geo+json",
        "Cache-Control": "no-store",
      } });
    }
    const data = await getPointFeed(snapshot);
    if (!data) return problem(404, "Snapshot not found.");
    const headers = new Headers({
      "Content-Type": "application/geo+json",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    // Keep snapshot storage compact and let Next.js negotiate HTTP compression.
    // Next removes Content-Encoding set by a route handler before sending the response.
    return new Response(new Uint8Array(gunzipSync(data)), { headers });
  } catch (error) {
    return databaseUnavailable(error);
  }
}
