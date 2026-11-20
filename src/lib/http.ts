export function problem(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export function databaseUnavailable(error: unknown) {
  console.error("Street Aware data request failed", error);
  return problem(503, "Data is temporarily unavailable.");
}
