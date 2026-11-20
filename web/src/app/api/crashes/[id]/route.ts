import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchFromMlApi } from "@/lib/api-client";
import { CrashDetail } from "@/lib/schemas";

const IdSchema = z.coerce.number().int().positive();

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const parsed = IdSchema.safeParse(params.id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid crash ID" }, { status: 400 });
  }

  const result = await fetchFromMlApi<CrashDetail>(`/crashes/${parsed.data}`);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
