import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFilterClauses } from "../src/lib/queries.ts";

test("builds filter SQL clauses with correct parameters and indexing", () => {
  const empty = buildFilterClauses({}, 1);
  assert.equal(empty.sql, "");
  assert.deepEqual(empty.values, []);
  assert.equal(empty.nextIndex, 1);

  const severityOnly = buildFilterClauses({ severity: "fatal" }, 4);
  assert.equal(severityOnly.sql, " AND severity = $4");
  assert.deepEqual(severityOnly.values, ["fatal"]);
  assert.equal(severityOnly.nextIndex, 5);

  const crashTypeOnly = buildFilterClauses({ crashType: "блъскане на пешеходец" }, 2);
  assert.equal(crashTypeOnly.sql, " AND crash_type = $2");
  assert.deepEqual(crashTypeOnly.values, ["блъскане на пешеходец"]);
  assert.equal(crashTypeOnly.nextIndex, 3);

  const yearOnly = buildFilterClauses({ year: 2025 }, 5);
  assert.ok(yearOnly.sql.includes("occurred_at"));
  assert.ok(yearOnly.sql.includes("$5"));
  assert.deepEqual(yearOnly.values, [2025]);
  assert.equal(yearOnly.nextIndex, 6);

  const timeOfDayDay = buildFilterClauses({ timeOfDay: "day" }, 1);
  assert.match(timeOfDayDay.sql, /BETWEEN 6 AND 17/);
  assert.deepEqual(timeOfDayDay.values, []);
  assert.equal(timeOfDayDay.nextIndex, 1);

  const timeOfDayNight = buildFilterClauses({ timeOfDay: "night" }, 1);
  assert.match(timeOfDayNight.sql, /NOT BETWEEN 6 AND 17/);

  const weekday = buildFilterClauses({ dayOfWeek: "weekday" }, 1);
  assert.ok(weekday.sql.includes("BETWEEN 1 AND 5"));

  const weekend = buildFilterClauses({ dayOfWeek: "weekend" }, 1);
  assert.match(weekend.sql, /IN \(6, 7\)/);

  const urban = buildFilterClauses({ place: "urban" }, 1);
  assert.ok(urban.sql.includes("в населено място"));

  const rural = buildFilterClauses({ place: "rural" }, 1);
  assert.ok(rural.sql.includes("извън населено място"));

  const combined = buildFilterClauses({
    severity: "injury",
    crashType: "челен сблъсък",
    year: 2024,
    timeOfDay: "night",
    dayOfWeek: "weekend",
    place: "urban",
  }, 10);

  assert.equal(combined.values.length, 3); // severity, crashType, year
  assert.deepEqual(combined.values, ["injury", "челен сблъсък", 2024]);
  assert.equal(combined.nextIndex, 13);
  assert.ok(combined.sql.includes("severity = $10"));
  assert.ok(combined.sql.includes("crash_type = $11"));
  assert.ok(combined.sql.includes("$12"));
});
