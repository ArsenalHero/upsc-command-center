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

test("the preset schedules days 1, 7, 14, 30 and 90 then finishes after five reviews", () => {
  const data = fixture(); data.settings.spacedRepetition!.mode = "preset";
  let review = completeRevision(data, "first-review", "2026-10-03").next!;
  for (const [step, dueDate] of ["2026-10-04", "2026-10-10", "2026-10-17", "2026-11-02", "2027-01-01"].entries()) {
    assert.equal(review.dueDate, dueDate); assert.equal(review.repetitionStep, step);
    const result = completeRevision(data, review.id, dueDate);
    if (step < 4) { assert.equal(result.created, true); review = result.next!; }
    else { assert.equal(result.created, false); assert.equal(result.next, undefined); }
  }
  assert.equal(data.revisions.length, 6); assert.ok(data.revisions.every(r => r.completedDate));
  const restored = validateData(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.revisions[5].repetitionStep, 4);
  assert.match(buildCSV(restored, "revisions"), /"repetitionStep"/);
});

test("late preset completions shift the next review forward and preserve the current sequence step", () => {
  const data = fixture(); data.settings.spacedRepetition!.mode = "preset";
  const first = completeRevision(data, "first-review", "2026-10-03").next!;
  const second = completeRevision(data, first.id, "2026-10-08").next!;
  assert.equal(second.dueDate, "2026-10-14"); assert.equal(second.repetitionStep, 1);
  assert.equal(first.dueDate, "2026-10-04"); assert.equal(first.completedDate, "2026-10-08");
  assert.equal(completeRevision(data, second.id, "2026-10-14").next!.dueDate, "2026-10-21");
});

test("preset progress survives a matching manual review and switching to custom starts the chosen interval", () => {
  const data = fixture(); data.settings.spacedRepetition!.mode = "preset";
  data.revisions.push({ ...data.revisions[0], id: "manual", dueDate: "2026-10-04" });
  const first = completeRevision(data, "first-review", "2026-10-03").next!;
  assert.equal(first.id, "manual"); assert.equal(first.repetitionStep, 0); assert.equal(data.revisions.length, 2);
  const second = completeRevision(data, first.id, "2026-10-04").next!;
  assert.equal(second.dueDate, "2026-10-10");
  data.settings.spacedRepetition = { enabled: true, mode: "custom", days: 3 };
  const custom = completeRevision(data, second.id, "2026-10-10").next!;
  assert.equal(custom.dueDate, "2026-10-13"); assert.equal(custom.repetitionStep, undefined);
  data.settings.spacedRepetition.mode = "preset";
  assert.equal(completeRevision(data, custom.id, "2026-10-13").next!.dueDate, "2026-10-14");
});

test("invalid preset modes and review steps are rejected before completion changes are saved", () => {
  for (const step of [-1, 5, 1.5, "1", NaN] as any[]) {
    const data = fixture(); data.revisions[0].repetitionStep = step;
    assert.throws(() => validateData(data), /preset review step/);
    assert.throws(() => completeRevision(data, "first-review", "2026-10-03"), /preset review step/);
    assert.equal(data.revisions[0].completedDate, "");
  }
  const data = fixture(); (data.settings.spacedRepetition as any).mode = "unknown";
  assert.throws(() => validateData(data), /Spaced repetition/);
  assert.throws(() => completeRevision(data, "first-review", "2026-10-03"), /preset or custom/);
  assert.equal(data.revisions[0].completedDate, "");
});
