import { NextResponse } from "next/server";
import { fetchFromMlApi } from "@/lib/api-client";
import { MunicipalityItem } from "@/lib/schemas";

export async function GET() {
  const result = await fetchFromMlApi<MunicipalityItem[]>("/municipalities");
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
