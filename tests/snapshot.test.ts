import assert from "node:assert/strict";
import { test } from "node:test";
import { countActiveFilters, deriveSeverity, parseBounds, parseCrashFilters, parseRowId, serializeFilters } from "../src/lib/crashes.ts";
import { columns, parseSnapshot } from "../scripts/snapshot-input.ts";

test("derives all severity classes and prioritizes known fatalities", () => {
  assert.equal(deriveSeverity(0, 0), "none");
  assert.equal(deriveSeverity(0, 1), "injury");
  assert.equal(deriveSeverity(1, 2), "fatal");
  assert.equal(deriveSeverity(1, null), "fatal");
  assert.equal(deriveSeverity(null, 1), "unknown");
  assert.equal(deriveSeverity(0, null), "unknown");
});

test("imports by header name, preserves duplicates and records invalid input fields", () => {
  const header = [...columns].reverse();
  const record = (details: Record<string, string | null>) => header.map((name) => details[name] ?? null);
  const valid = record({
    latitude: "42.6977001", longitude: "23.3219002", crashdatetime: "2026-11-20 07:45:00",
    diedcount: "0", injuredcount: "2", crashtype: "друг вид ПТП",
  });
  const { rows, exactRepeats } = parseSnapshot(JSON.stringify([
    header, valid, valid,
    record({ latitude: "42.69", longitude: "" }),
    record({ latitude: "900", longitude: "23.32", crashdatetime: "2026-02-31 07:00:00", diedcount: "-1" }),
  ]));
  assert.equal(exactRepeats, 1);
  assert.deepEqual(rows.map((row) => row.row_no), [1, 2, 3, 4]);
  assert.deepEqual(rows.map((row) => row.coordinate_status), ["valid", "valid", "missing", "invalid"]);
  assert.equal(rows[0].longitude, 23.3219002);
  assert.equal(rows[0].occurred_at, "2026-11-20 07:45:00");
  assert.equal(rows[0].crash_type, "друг вид ПТП");
  assert.equal(rows[3].occurred_at, null);
  assert.equal(rows[3].severity, "unknown");
});

test("rejects a wrong header and an incomplete row", () => {
  assert.throws(() => parseSnapshot(JSON.stringify([["crashdatetime"], ["2024-01-01"]])), /19 unique/);
  assert.throws(() => parseSnapshot(JSON.stringify([columns, ["0"]])), /Crash row 1/);
});

test("validates list bounds and row IDs", () => {
  assert.deepEqual(parseBounds("22,41,29,45"), [22, 41, 29, 45]);
  for (const invalid of ["22,,29,45", "29,41,22,45", "22,41,29,91", "22,NaN,29,45"]) {
    assert.equal(parseBounds(invalid), null);
  }
  assert.equal(parseRowId("102103"), 102103);
  assert.equal(parseRowId("2147483648"), null);
  assert.equal(parseRowId("1e2"), null);
});

test("parses, counts and serializes valid and invalid crash filters", () => {
  const empty = parseCrashFilters(new URLSearchParams());
  assert.deepEqual(empty, {});
  assert.equal(countActiveFilters(empty), 0);

  const valid = parseCrashFilters(new URLSearchParams({
    severity: "fatal",
    timeOfDay: "night",
    dayOfWeek: "weekend",
    crashType: "сблъскване между МПС челно",
    place: "urban",
    year: "2025",
  }));
  assert.deepEqual(valid, {
    severity: "fatal",
    timeOfDay: "night",
    dayOfWeek: "weekend",
    crashType: "сблъскване между МПС челно",
    place: "urban",
    year: 2025,
  });
  assert.equal(countActiveFilters(valid), 6);

  const serialized = serializeFilters(valid);
  assert.equal(serialized.get("severity"), "fatal");
  assert.equal(serialized.get("timeOfDay"), "night");
  assert.equal(serialized.get("dayOfWeek"), "weekend");
  assert.equal(serialized.get("crashType"), "сблъскване между МПС челно");
  assert.equal(serialized.get("place"), "urban");
  assert.equal(serialized.get("year"), "2025");

  const invalid = parseCrashFilters(new URLSearchParams({
    severity: "catastrophic",
    timeOfDay: "noon",
    dayOfWeek: "funday",
    place: "mars",
    year: "1899",
  }));
  assert.deepEqual(invalid, {});
  assert.equal(countActiveFilters(invalid), 0);
});
