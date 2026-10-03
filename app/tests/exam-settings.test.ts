import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyData } from "../src/data/defaults";
import { cseExamDates, changeCseYear, dashboardExams, examCountdown, workspaceExamLabel } from "../src/utils/examSettings";
import { validateData } from "../src/services/validation";

test("CSE 2027 uses the supplied dates for new and older workspaces without replacing custom dates", () => {
  const settings = createEmptyData().settings;
  settings.year = 2027; settings.prelimsDate = ""; settings.mainsDate = "";
  assert.deepEqual(dashboardExams(settings).map(e => e.date), ["2027-05-23", "2027-08-20"]);
  settings.prelimsDate = "2027-06-01";
  assert.equal(dashboardExams(settings)[0].date, "2027-06-01");
  settings.year = 2028;
  assert.deepEqual(dashboardExams(settings).map(e => e.date), ["2027-06-01", ""]);
});

test("changing the CSE year replaces calendar defaults while keeping personally entered dates", () => {
  const settings = { ...createEmptyData().settings, year: 2027, prelimsDate: cseExamDates[2027].prelims, mainsDate: "2027-08-25" };
  const later = changeCseYear(settings, 2028);
  assert.equal(later.prelimsDate, ""); assert.equal(later.mainsDate, "2027-08-25");
  const back = changeCseYear(later, 2027);
  assert.equal(back.prelimsDate, "2027-05-23"); assert.equal(back.mainsDate, "2027-08-25");
});

test("State PSC dates replace dashboard targets and switching back keeps both exam configurations", () => {
  const data = createEmptyData(); data.settings.year = 2027;
  data.settings.examType = "State PSC"; data.settings.statePscName = "BPSC 73rd CCE"; data.settings.statePscDate = "2027-03-14";
  assert.deepEqual(dashboardExams(data.settings), [{ id: "state-psc", name: "BPSC 73rd CCE", date: "2027-03-14" }]);
  assert.equal(workspaceExamLabel(data.settings), "BPSC 73rd CCE");
  const backup = validateData(JSON.parse(JSON.stringify(data)));
  backup.settings.examType = "UPSC CSE";
  assert.equal(dashboardExams(backup.settings).length, 2);
  assert.equal(backup.settings.statePscDate, "2027-03-14");
  delete backup.settings.examType; delete backup.settings.statePscDate; delete backup.settings.statePscName;
  assert.equal(dashboardExams(validateData(backup).settings)[0].name, "CSE 2027 Prelims");
});

test("countdowns decompose seconds accurately and target midnight IST in every browser timezone", () => {
  assert.deepEqual(examCountdown("2027-05-23", Date.parse("2027-05-21T17:27:56+05:30")), { days: 1, hours: 6, minutes: 32, seconds: 4, totalSeconds: 109924, reached: false });
  assert.equal(examCountdown("2027-05-23", Date.parse("2027-05-22T18:29:59Z"))!.seconds, 1);
  const atDate = examCountdown("2027-05-23", Date.parse("2027-05-22T18:30:00Z"))!;
  assert.equal(atDate.reached, true); assert.equal(atDate.totalSeconds, 0);
  assert.equal(examCountdown("2027-05-23", Date.parse("2028-01-01T00:00:00Z"))!.totalSeconds, 0);
  for (const date of ["", "2027-02-29", "2027-04-31", "2027-13-01", "not-a-date"]) assert.equal(examCountdown(date), null);
});

test("exam preference validation rejects malformed state settings while older backups still work", () => {
  const data = createEmptyData();
  for (const [name, date] of [["", "2027-03-14"], ["  ", "2027-03-14"], ["BPSC", ""], ["BPSC", "2027-02-30"]]) {
    data.settings.examType = "State PSC"; data.settings.statePscName = name; data.settings.statePscDate = date;
    assert.throws(() => validateData(data), /State PSC/);
  }
  data.settings.examType = "UPSC CSE"; data.settings.statePscName = "BPSC"; data.settings.statePscDate = "2027-03-14";
  validateData(data);
  (data.settings as any).examType = "Anything";
  assert.throws(() => validateData(data), /UPSC CSE or State PSC/);
});
