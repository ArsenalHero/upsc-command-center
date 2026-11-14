import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults";
import { todaySnapshot, studyDuration, matchingPages, currentPage, recordSearchIndex, matchingRecords } from "../src/utils/workspaceUX";
import { addDays, dateKey } from "../src/utils/date";
import type { StudySession } from "../src/types";

const day = dateKey();
const session = (id: string, date: string, minutes: number): StudySession => ({ id, date, startTime: "", endTime: "", stage: "Prelims", paper: "Prelims GS", subjectId: "subject-3", topicId: "topic-3-0", subtopicId: "", resourceId: "", activity: "New Learning", plannedMinutes: 0, actualMinutes: minutes, questionsPlanned: 0, questionsAttempted: 0, correct: 0, incorrect: 0, pyqs: 0, mainsAnswers: 0, revisionDone: false, mockScore: 0, maximumMarks: 200, focus: 7, energy: 7, difficulty: 3, distractionMinutes: 0, notes: "", problems: "", nextRevisionDate: "" });

test("six recorded hours keeps the remaining two hours visible until the configured target is reached", () => {
  const data = createEmptyData(); data.settings.dailyHours = 8;
  data.sessions = [session("today", day, 360), session("yesterday", addDays(day, -1), 120)];
  const current = todaySnapshot(data, day);
  assert.equal(current.seconds, 21600);
  assert.equal(current.progress, 75);
  assert.equal(current.remainingMinutes, 120);
  assert.equal(current.targetReached, false);
  data.sessions[0].actualMinutes = 540;
  assert.equal(todaySnapshot(data, day).targetReached, true);
  assert.equal(todaySnapshot(data, day).progress, 100);
  assert.equal(todaySnapshot(data, day).remainingMinutes, 0);
});
test("a nearly reached target is calculated from exact time rather than rounded analytics hours", () => {
  const data = createEmptyData(); data.settings.dailyHours = 1;
  data.sessions = [session("today", day, 59.9)];
  const current = todaySnapshot(data, day);
  assert.equal(current.targetReached, false);
  assert.equal(current.remainingMinutes, 1);
  assert.ok(current.progress < 100);
  assert.equal(studyDuration(25 * 60), "25 min");
  assert.equal(studyDuration(6 * 3600), "6h");
  assert.equal(studyDuration(30), "Less than 1 min");
});
test("revision queue includes overdue and due-today items without changing saved order", () => {
  const data = createEmptyData();
  data.revisions = [
    { id: "future", subjectId: "subject-3", topicId: "topic-3-0", dueDate: addDays(day, 1), completedDate: "", stage: "Revision 1", notes: "" },
    { id: "today", subjectId: "subject-3", topicId: "topic-3-0", dueDate: day, completedDate: "", stage: "Revision 1", notes: "" },
    { id: "old", subjectId: "subject-3", topicId: "topic-3-0", dueDate: addDays(day, -1), completedDate: "", stage: "Revision 1", notes: "" },
    { id: "done", subjectId: "subject-3", topicId: "topic-3-0", dueDate: day, completedDate: day, stage: "Revision 1", notes: "" },
  ];
  const original = data.revisions.map(r => r.id), current = todaySnapshot(data, day);
  assert.deepEqual(current.due.map(r => r.id), ["old", "today"]);
  assert.equal(current.completedToday, 1);
  assert.equal(current.next?.id, "old");
  assert.deepEqual(data.revisions.map(r => r.id), original);
});
test("nested pages resolve to their owning module and mobile search recognises familiar page names", () => {
  const pages = [{ path: "/", label: "Dashboard", group: "WORKSPACE" }, { path: "/tests", label: "Tests", group: "PRACTICE" }, { path: "/pyqs", label: "PYQs", group: "PRACTICE" }, { path: "/settings", label: "Settings", group: "SETTINGS" }];
  assert.equal(currentPage(pages, "/tests/prelims/discover")?.label, "Tests");
  assert.equal(currentPage(pages, "/tests-other"), undefined);
  assert.equal(currentPage(pages, "/")?.label, "Dashboard");
  assert.deepEqual(matchingPages(pages, "golden gate").map(p => p.path), ["/tests"]);
  assert.deepEqual(matchingPages(pages, "papers").map(p => p.path), ["/pyqs"]);
  assert.deepEqual(matchingPages(pages, "wallpapers").map(p => p.path), ["/settings"]);
  assert.equal(pages[0].label, "Dashboard");
});
test("record search resolves subject and topic names, supports multiple words and searches values rather than field names", () => {
  const data = createEmptyData();
  const records = [session("one", day, 25), { ...session("two", day, 40), subjectId: "subject-0", topicId: "topic-0-0", notes: "Read old kingdoms" }];
  const index = recordSearchIndex(data, records);
  assert.deepEqual(matchingRecords(index, "Polity Constitution").map(r => r.id), ["one"]);
  assert.deepEqual(matchingRecords(index, "HISTORY kingdoms").map(r => r.id), ["two"]);
  assert.deepEqual(matchingRecords(index, "  polity   constitution  ").map(r => r.id), ["one"]);
  assert.equal(matchingRecords(index, "actualMinutes").length, 0);
  assert.equal(matchingRecords(index, "").length, 2);
});
