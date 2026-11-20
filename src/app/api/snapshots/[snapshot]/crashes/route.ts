import { isSnapshotId, parseBounds, parseRowId } from "@/lib/crashes";
import { databaseUnavailable, problem } from "@/lib/http";
import { listCrashes } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ snapshot: string }> }) {
  const { snapshot } = await params;
  if (!isSnapshotId(snapshot)) return problem(404, "Snapshot not found.");
  const query = new URL(request.url).searchParams;
  const cursor = query.get("after");
  const boundsQuery = query.get("bounds");
  const after = cursor === null ? 0 : parseRowId(cursor);
  const bounds = boundsQuery === null ? null : parseBounds(boundsQuery);
  if (after === null || (boundsQuery !== null && bounds === null)) return problem(400, "Invalid list parameters.");

  try {
    return Response.json(await listCrashes(snapshot, after, bounds));
  } catch (error) {
    return databaseUnavailable(error);
  }
}
