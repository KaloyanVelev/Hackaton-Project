import { isSnapshotId } from "@/lib/crashes";
import { problem, databaseUnavailable } from "@/lib/http";
import { getCurrentSnapshot, getAggregatedStats, hasSnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("snapshot");
  if (requested !== null && !isSnapshotId(requested)) return problem(400, "Invalid snapshot ID.");

  try {
    const snapshotId = requested ?? (await getCurrentSnapshot())?.id;
    if (!snapshotId || (requested !== null && !(await hasSnapshot(snapshotId)))) {
      return problem(404, "Crash snapshot not found.");
    }
    const stats = await getAggregatedStats(snapshotId);
    return Response.json(
      { stats, snapshotId },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    return databaseUnavailable(error);
  }
}
