import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults";
import { completeRevision } from "../src/utils/revision";
import { validateData } from "../src/services/validation";
import { buildCSV } from "../src/services/export";

const fixture = () => {
  const data = createEmptyData(), topic = data.topics[0];
  data.settings.spacedRepetition = { enabled: true, days: 7 };
  data.revisions = [{ id: "first-review", subjectId: topic.subjectId, topicId: topic.id, dueDate: "2026-09-28", completedDate: "", stage: "Revision 1", notes: "Recall without notes" }];
  return data;
};

test("spaced repetition schedules from the actual completion date and retains the original history", () => {
  const data = fixture(), original = structuredClone(data.revisions[0]), oldHistory = data.topics[0].statusHistory.length;
  const result = completeRevision(data, original.id, "2026-10-03");
  assert.equal(result.created, true); assert.equal(result.next!.dueDate, "2026-10-10");
  assert.equal(data.revisions[0].dueDate, "2026-09-28"); assert.equal(data.revisions[0].completedDate, "2026-10-03");
  for (const key of ["subjectId", "topicId", "stage", "notes"] as const) assert.equal(result.next![key], original[key]);
  assert.equal(result.next!.completedDate, ""); assert.equal(result.next!.repeatOf, original.id);
  assert.equal(data.topics[0].statusHistory.length, oldHistory + 1);
  assert.deepEqual(completeRevision(data, original.id, "2026-10-04"), { completed: false, created: false });
  assert.equal(data.revisions.length, 2); assert.equal(data.topics[0].statusHistory.length, oldHistory + 1);
  validateData(data);
});

test("changed intervals apply on the next completion and switching off stops creating further repeats", () => {
  const data = fixture();
  const next = completeRevision(data, "first-review", "2026-10-03").next!;
  data.settings.spacedRepetition!.days = 14;
  const following = completeRevision(data, next.id, "2026-10-11").next!;
  assert.equal(following.dueDate, "2026-10-25"); assert.equal(following.repeatOf, next.id);
  data.settings.spacedRepetition!.enabled = false;
  assert.equal(completeRevision(data, following.id, "2026-10-26").created, false);
  assert.equal(data.revisions.length, 3); assert.ok(data.revisions.every(r => r.completedDate));
});

test("an existing pending review for the same topic/date is reused and completed sources never generate duplicate repeats", () => {
  const data = fixture(), original = data.revisions[0];
  data.revisions.push({ ...original, id: "manual-followup", dueDate: "2026-10-10", notes: "Keep this manual plan" });
  const result = completeRevision(data, original.id, "2026-10-03");
  assert.equal(result.created, false); assert.equal(result.next!.id, "manual-followup");
  assert.equal(result.next!.notes, "Keep this manual plan"); assert.equal(data.revisions.length, 2);
  const other = fixture();
  const child = completeRevision(other, "first-review", "2026-10-03").next!;
  other.revisions[0].completedDate = "";
  assert.equal(completeRevision(other, "first-review", "2026-10-04").next!.id, child.id);
  assert.equal(other.revisions.length, 2);
});

test("calendar intervals cross months, years and leap days as calendar days", () => {
  for (const [date, days, expected] of [["2026-12-30",7,"2027-01-06"], ["2028-02-28",1,"2028-02-29"], ["2026-10-31",2,"2026-11-02"], ["2026-01-01",365,"2027-01-01"]] as const) {
    const data = fixture(); data.settings.spacedRepetition!.days = days;
    assert.equal(completeRevision(data, "first-review", date).next!.dueDate, expected);
  }
});

test("older workspaces stay opt-in; backups and revision CSV preserve settings and repetition links", () => {
  const old = fixture(); delete old.settings.spacedRepetition;
  validateData(old); assert.equal(completeRevision(old, "first-review", "2026-10-03").created, false); assert.equal(old.revisions.length, 1);
  const data = fixture(); completeRevision(data, "first-review", "2026-10-03");
  const restored = validateData(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored.settings.spacedRepetition, { enabled: true, days: 7 });
  assert.equal(restored.revisions[1].repeatOf, "first-review"); assert.equal(restored.revisions[1].dueDate, "2026-10-10");
  assert.match(buildCSV(restored, "revisions"), /"repeatOf"/);
  for (const days of [0,-1,1.5,366,NaN,Infinity,"7"] as any[]) {
    const invalid = fixture(); invalid.settings.spacedRepetition!.days = days;
    assert.throws(() => validateData(invalid), /Spaced repetition/);
    assert.throws(() => completeRevision(invalid, "first-review", "2026-10-03"), /whole number/);
    assert.equal(invalid.revisions[0].completedDate, ""); assert.equal(invalid.revisions.length, 1);
  }
});
