export function problem(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export function databaseUnavailable(error: unknown) {
  console.error("Street Aware data request failed", error);
  return problem(503, "Data is temporarily unavailable.");
}

export function acceptsGzip(header: string | null) {
  const codings = new Map(
    (header ?? "").toLowerCase().split(",").map((item) => {
      const [name, ...parameters] = item.split(";").map((part) => part.trim());
      const quality = parameters.find((part) => part.startsWith("q="));
      return [name, quality ? Number(quality.slice(2)) : 1];
    }),
  );
  return (codings.get("gzip") ?? codings.get("*") ?? 0) > 0;
}
