import { databaseUnavailable } from "@/lib/http";
import { getCurrentSnapshot } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(
      { snapshot: await getCurrentSnapshot() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return databaseUnavailable(error);
  }
}
