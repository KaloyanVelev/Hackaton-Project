import assert from "node:assert/strict";
import { test } from "node:test";
import { copy } from "../src/lib/language.ts";

test("language dictionaries provide bilingual copy for minimizable intro panel", () => {
  assert.ok(copy.bg.collapseIntro, "Bulgarian collapseIntro copy must be defined");
  assert.ok(copy.bg.expandIntro, "Bulgarian expandIntro copy must be defined");
  assert.ok(copy.en.collapseIntro, "English collapseIntro copy must be defined");
  assert.ok(copy.en.expandIntro, "English expandIntro copy must be defined");

  assert.equal(typeof copy.bg.collapseIntro, "string");
  assert.equal(typeof copy.bg.expandIntro, "string");
  assert.equal(typeof copy.en.collapseIntro, "string");
  assert.equal(typeof copy.en.expandIntro, "string");

  assert.notEqual(copy.bg.collapseIntro.trim(), "");
  assert.notEqual(copy.bg.expandIntro.trim(), "");
  assert.notEqual(copy.en.collapseIntro.trim(), "");
  assert.notEqual(copy.en.expandIntro.trim(), "");
});
