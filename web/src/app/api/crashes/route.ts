import { NextRequest, NextResponse } from "next/server";
import { fetchFromMlApi } from "@/lib/api-client";
import { CrashQueryParamsSchema, CrashFeatureCollection } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());

  const parsed = CrashQueryParamsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined && value !== null) {
      query.set(key, String(value));
    }
  }

  const result = await fetchFromMlApi<CrashFeatureCollection>(`/crashes?${query.toString()}`);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
