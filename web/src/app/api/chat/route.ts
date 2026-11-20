import { NextRequest, NextResponse } from "next/server";
import { fetchFromMlApi } from "@/lib/api-client";
import { ChatRequestSchema, ChatResponse } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }

  const result = await fetchFromMlApi<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
