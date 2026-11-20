import { database } from "@/lib/db";
import { problem } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await database().query<{ ready: boolean }>(
      "SELECT to_regclass('current_crash_snapshot') IS NOT NULL AS ready",
    );
    if (rows[0]?.ready) return Response.json({ ready: true });
  } catch {
    return problem(503, "Database is unavailable.");
  }
  return problem(503, "Database schema is pending.");
}
