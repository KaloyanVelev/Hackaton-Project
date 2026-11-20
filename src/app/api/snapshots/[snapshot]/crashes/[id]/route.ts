import { isSnapshotId, parseRowId } from "@/lib/crashes";
import { databaseUnavailable, problem } from "@/lib/http";
import { getCrash } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ snapshot: string; id: string }> }) {
  const { snapshot, id } = await params;
  const rowId = parseRowId(id);
  if (!isSnapshotId(snapshot) || rowId === null) return problem(404, "Crash not found.");

  try {
    const crash = await getCrash(snapshot, rowId);
    return crash ? Response.json(crash) : problem(404, "Crash not found.");
  } catch (error) {
    return databaseUnavailable(error);
  }
}
