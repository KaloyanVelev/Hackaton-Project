import { problem, databaseUnavailable } from "@/lib/http";
import { getCurrentSnapshot, getAggregatedStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const snapshotParam = url.searchParams.get("snapshot");
    const current = await getCurrentSnapshot();
    const snapshotId = snapshotParam || current?.id;

    if (!snapshotId) {
      return problem(404, "No crash snapshot available.");
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
