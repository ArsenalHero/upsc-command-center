import test from "node:test";
import assert from "node:assert/strict";
import { goldenBaseFilters, goldenSummaryCSV, readGoldenSearch, sortGoldenTests } from "../src/utils/goldenGate";
import type { MockAttempt, MockTest } from "../src/utils/mockLab";

test("saved searches keep only supported scalar filters", () => {
  assert.equal(readGoldenSearch("not json"), null);
  assert.equal(readGoldenSearch("[]"), null);
  assert.deepEqual(readGoldenSearch('{"paper":"CSAT","search":"polity","op":"admin","limit":"2000","__proto__":"x","year":2027,"topic":[]}'), { paper: "CSAT", search: "polity" });
});
test("resetting a collection retains its defining paper or test type", () => {
  assert.deepEqual(goldenBaseFilters("csat"), { paper: "CSAT" });
  assert.deepEqual(goldenBaseFilters("sectional"), { kind: "Sectional" });
  assert.deepEqual(goldenBaseFilters("full-length"), { kind: "Full Length" });
  assert.deepEqual(goldenBaseFilters("discover"), {});
});
test("page sorting excludes the server's lookahead row and preserves catalogue order", () => {
  const tests = Array.from({ length: 13 }, (_, i) => ({ id: String(i), duration: 100 - i, participants: i, year: 2020 + i } as MockTest));
  const original = tests.map(t => t.id);
  assert.equal(sortGoldenTests(tests, "duration")[0].id, "11");
  assert.equal(sortGoldenTests(tests, "participants").length, 12);
  assert.equal(sortGoldenTests(tests, "year")[0].year, 2031);
  assert.deepEqual(tests.map(t => t.id), original);
});
const attempt = {
  status: "submitted", eligible: true, submittedAt: "2026-10-12T17:00:00Z",
  test: { name: '=HYPERLINK("https://example.test")', paper: "GS-I", coaching: "Example, Academy", year: 2027 },
  result: { score: -4, maximum: 200, correct: 0, incorrect: 6, unattempted: 94, accuracy: 0, attemptRate: 6, negative: 4, seconds: 600, questions: [{ question: "Private question text" }] },
  position: { rank: 17, percentile: 23 },
} as MockAttempt;
test("summary downloads preserve numeric scores, escape text and omit question content", () => {
  const csv = goldenSummaryCSV(attempt);
  assert.match(csv, /"Net score",-4/);
  assert.match(csv, /'\=HYPERLINK/);
  assert.match(csv, /"Example, Academy"/);
  assert.doesNotMatch(csv, /Private question text/);
  assert.match(csv, /"Eligible rank",17/);
});
test("practice summaries do not claim an eligible rank, and running tests cannot export", () => {
  const csv = goldenSummaryCSV({ ...attempt, eligible: false });
  assert.match(csv, /"Eligible rank","Practice only"/);
  assert.match(csv, /"Eligible percentile","Practice only"/);
  assert.throws(() => goldenSummaryCSV({ ...attempt, status: "running" }), /Submit the test/);
});
