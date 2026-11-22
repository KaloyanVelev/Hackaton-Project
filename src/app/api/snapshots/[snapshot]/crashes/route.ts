import { isSnapshotId, parseBounds, parseCrashFilters, parseRowId } from "@/lib/crashes";
import { databaseUnavailable, problem } from "@/lib/http";
import { countCrashesInBounds, listCrashes } from "@/lib/queries";

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
  const filters = parseCrashFilters(query);

  try {
    const [page, total] = await Promise.all([
      listCrashes(snapshot, after, bounds, filters),
      bounds && cursor === null && query.get("includeTotal") === "1"
        ? countCrashesInBounds(snapshot, bounds, filters) : undefined,
    ]);
    return Response.json({ ...page, total });
  } catch (error) {
    return databaseUnavailable(error);
  }
}
