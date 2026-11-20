import assert from "node:assert/strict";
import { test } from "node:test";
import type { AggregatedStats } from "../src/lib/crashes.ts";
import { formatStatsSummary, validateStatsPayload } from "../src/lib/crashes.ts";

test("validateStatsPayload validates complete stats payload structure", () => {
  const sample: AggregatedStats = {
    totals: { totalCrashes: 102103, totalDeaths: 1381, totalInjured: 24003 },
    hourly: [{ hour: 17, count: 7413, deaths: 101, injured: 1500 }],
    crashTypes: [{ type: "сблъскване между МПС странично", count: 17232, deaths: 143, injured: 3512 }],
    regions: [{ region: "СОФИЯ", count: 27549, deaths: 108, injured: 2427 }],
    dayOfWeek: [{ day: 6, count: 13152, deaths: 239, injured: 3522 }],
    urbanRural: [
      { place: "в населено място", count: 72226, deaths: 400, injured: 15000 },
      { place: "извън населено място", count: 29877, deaths: 981, injured: 9003 }
    ],
    monthly: [{ month: 7, count: 9742, deaths: 155, injured: 2848 }],
    roadFeatures: [{ feature: "пешеходна пътека очертана с пътна маркировка", count: 2383, deaths: 50, injured: 2400 }]
  };

  assert.equal(validateStatsPayload(sample), true);
  assert.equal(validateStatsPayload(null), false);
  assert.equal(validateStatsPayload({}), false);
  assert.equal(validateStatsPayload({ totals: null }), false);
});

test("formatStatsSummary produces correct highlights for quick carousel cards", () => {
  const sample: AggregatedStats = {
    totals: { totalCrashes: 102103, totalDeaths: 1381, totalInjured: 24003 },
    hourly: [
      { hour: 4, count: 785, deaths: 11, injured: 100 },
      { hour: 17, count: 7413, deaths: 101, injured: 1500 }
    ],
    crashTypes: [
      { type: "блъскане на пешеходец", count: 4931, deaths: 240, injured: 4536 },
      { type: "сблъскване между МПС странично", count: 17232, deaths: 143, injured: 3512 }
    ],
    regions: [
      { region: "СОФИЯ", count: 27549, deaths: 108, injured: 2427 },
      { region: "ПЛОВДИВ", count: 7856, deaths: 145, injured: 2023 }
    ],
    dayOfWeek: [
      { day: 1, count: 15828, deaths: 208, injured: 3844 },
      { day: 6, count: 13152, deaths: 239, injured: 3522 }
    ],
    urbanRural: [
      { place: "в населено място", count: 72226, deaths: 400, injured: 15000 },
      { place: "извън населено място", count: 29877, deaths: 981, injured: 9003 }
    ],
    monthly: [
      { month: 12, count: 6050, deaths: 94, injured: 1323 },
      { month: 7, count: 9742, deaths: 155, injured: 2848 }
    ],
    roadFeatures: [
      { feature: "пешеходна пътека очертана с пътна маркировка", count: 2383, deaths: 50, injured: 2400 }
    ]
  };

  const highlights = formatStatsSummary(sample);
  assert.equal(highlights.peakHour, 17);
  assert.equal(highlights.deadliestCrashType, "блъскане на пешеходец");
  assert.equal(highlights.deadliestRegion, "ПЛОВДИВ");
  assert.equal(highlights.deadliestDay, 6);
  assert.equal(highlights.peakMonth, 7);
  assert.equal(highlights.topFeature, "пешеходна пътека очертана с пътна маркировка");
});
