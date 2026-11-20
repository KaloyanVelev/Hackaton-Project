import { gunzipSync } from "node:zlib";
import { isSnapshotId } from "@/lib/crashes";
import { acceptsGzip, databaseUnavailable, problem } from "@/lib/http";
import { getPointFeed } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ snapshot: string }> }) {
  const { snapshot } = await params;
  if (!isSnapshotId(snapshot)) return problem(404, "Snapshot not found.");

  try {
    const data = await getPointFeed(snapshot);
    if (!data) return problem(404, "Snapshot not found.");
    const gzip = acceptsGzip(request.headers.get("accept-encoding"));
    const headers = new Headers({
      "Content-Type": "application/geo+json",
      "Cache-Control": "public, max-age=31536000, immutable",
      Vary: "Accept-Encoding",
    });
    if (gzip) headers.set("Content-Encoding", "gzip");
    return new Response(new Uint8Array(gzip ? data : gunzipSync(data)), { headers });
  } catch (error) {
    return databaseUnavailable(error);
  }
}
