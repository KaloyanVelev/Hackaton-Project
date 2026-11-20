import { gunzipSync } from "node:zlib";
import { isSnapshotId } from "@/lib/crashes";
import { databaseUnavailable, problem } from "@/lib/http";
import { getPointFeed } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ snapshot: string }> }) {
  const { snapshot } = await params;
  if (!isSnapshotId(snapshot)) return problem(404, "Snapshot not found.");

  try {
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
