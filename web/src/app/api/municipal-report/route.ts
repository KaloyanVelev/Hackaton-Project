import { NextRequest, NextResponse } from "next/server";
import { fetchFromMlApi } from "@/lib/api-client";
import { MunicipalReportParamsSchema, MunicipalReport } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const rawParams = Object.fromEntries(url.searchParams.entries());

  const parsed = MunicipalReportParamsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const query = new URLSearchParams({ municipality: parsed.data.municipality });
  const result = await fetchFromMlApi<MunicipalReport>(`/municipal-report?${query.toString()}`);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
