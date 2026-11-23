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

    const { longitude, latitude } = crashes[0];
    const [left, bottom, right, top] = [longitude - 0.06, latitude - 0.06, longitude + 0.06, latitude + 0.06];
    const inArea = points.features.filter(({ geometry: { coordinates: [x, y] } }) =>
      x >= left && x <= right && y >= bottom && y <= top);
    const areaUrl = new URL(snapshotUrl + "/crashes", base);
    areaUrl.searchParams.set("bounds", [left, bottom, right, top].join(","));
    areaUrl.searchParams.set("includeTotal", "1");
    const area = await fetch(areaUrl);
    assert.equal(area.status, 200);
    const areaPage = await area.json() as CrashPage;
    assert.equal(areaPage.total, inArea.length);
    assert.deepEqual(areaPage.crashes.map(({ id }) => id), inArea.slice(0, 30).map(({ id }) => id));
  }
});

test("the filtered map feed and paginated crash list return the same mapped crashes", async () => {
  const meta = await fetch(new URL("/api/snapshot", base));
  assert.equal(meta.status, 200);
  const { snapshot } = await meta.json() as { snapshot: Snapshot | null };
  assert.ok(snapshot);
  const snapshotUrl = `/api/snapshots/${snapshot.id}`;
  const filterQueries = [
    "dayOfWeek=weekday", "dayOfWeek=weekend", "timeOfDay=night", "severity=fatal", "place=rural",
    "dayOfWeek=weekend&timeOfDay=night&severity=fatal&place=rural", "crashType=no-such-crash-type",
    new URLSearchParams({ crashType: "блъскане на пешеходец" }).toString(),
  ];
  if (snapshot.firstAt) filterQueries.push(`year=${snapshot.firstAt.slice(0, 4)}`);
  const days = new Map<string, Set<number | string | undefined>>();

  for (const query of filterQueries) {
    const listParams = new URLSearchParams(query);
    listParams.set("bounds", "-180,-90,180,90");
    listParams.set("includeTotal", "1");
    const [response, list] = await Promise.all([
      fetch(new URL(`${snapshotUrl}/points.geojson?${query}`, base)),
      fetch(new URL(`${snapshotUrl}/crashes?${listParams}`, base)),
    ]);
    assert.equal(response.status, 200, query);
    assert.equal(list.status, 200, query);
    const { features } = await response.json() as CrashPoints;
    const page = await list.json() as CrashPage;
    assert.equal(page.total, features.length, query);
    assert.deepEqual(page.crashes.map(({ id }) => id), features.slice(0, 30).map(({ id }) => id), query);
    if (page.next !== null) {
      listParams.set("after", String(page.next));
      const more = await fetch(new URL(`${snapshotUrl}/crashes?${listParams}`, base));
      assert.equal(more.status, 200, query);
      const nextPage = await more.json() as CrashPage;
      assert.deepEqual(nextPage.crashes.map(({ id }) => id), features.slice(30, 60).map(({ id }) => id), query);
    }
    if (query === "dayOfWeek=weekday" || query === "dayOfWeek=weekend") {
      days.set(query, new Set(features.map(({ id }) => id)));
    }
    if (query === "severity=fatal") assert.ok(features.every(({ properties }) => properties.severity === "fatal"));
    if (query === "crashType=no-such-crash-type") assert.equal(features.length, 0);
  }

  const weekdays = days.get("dayOfWeek=weekday")!;
  const weekends = days.get("dayOfWeek=weekend")!;
  assert.ok([...weekends].every((id) => !weekdays.has(id)), "A crash cannot happen on both a weekday and a weekend.");
});
