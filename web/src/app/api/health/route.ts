import { NextResponse } from "next/server";
import { fetchFromMlApi } from "@/lib/api-client";
import type { HealthResponse } from "@/lib/schemas";

export async function GET() {
  const result = await fetchFromMlApi<HealthResponse>("/health");
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
