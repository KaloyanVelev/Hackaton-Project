import assert from "node:assert/strict";
import { test } from "node:test";
import type { CrashPage, CrashPoints, Snapshot } from "../src/lib/crashes.ts";

const base = process.env.STREET_AWARE_URL ?? `http://localhost:${process.env.APP_PORT ?? "3000"}`;

test("the running demo delivers the active snapshot and a browser-decodable map feed", async () => {
  const health = await fetch(new URL("/api/health", base));
  assert.equal(health.status, 200);
  const meta = await fetch(new URL("/api/snapshot", base));
  assert.equal(meta.status, 200);
  const { snapshot } = await meta.json() as { snapshot: Snapshot | null };
  assert.ok(snapshot, "Import a crash snapshot before running the demo smoke test.");
  assert.equal(snapshot.sourceCount,
    snapshot.mappedCount + snapshot.missingCoordinates + snapshot.invalidCoordinates + snapshot.outsideCountry);
  const snapshotUrl = `/api/snapshots/${snapshot.id}`;
  const response = await fetch(new URL(snapshotUrl + "/points.geojson", base), {
    headers: { "Accept-Encoding": "gzip" },
  });
  assert.equal(response.status, 200);
  if (snapshot.mappedCount >= 100) assert.equal(response.headers.get("Content-Encoding"), "gzip");
  const points = await response.json() as CrashPoints;
  assert.equal(points.features.length, snapshot.mappedCount);
  assert.equal(new Set(points.features.map(({ id }) => id)).size, snapshot.mappedCount);
  const list = await fetch(new URL(snapshotUrl + "/crashes", base));
  assert.equal(list.status, 200);
  const { crashes } = await list.json() as CrashPage;
  if (crashes.length > 0) {
    const detail = await fetch(new URL(snapshotUrl + "/crashes/" + crashes[0].id, base));
    assert.equal(detail.status, 200);
    assert.deepEqual(await detail.json(), crashes[0]);
  }
});
