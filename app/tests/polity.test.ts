import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyData } from "../src/data/defaults";
import { emptyFilters, emptyPrelims, emptyResponse, filterQuestions, keySnapshot, responseAttempt, sessionReport, startSession } from "../src/utils/prelims";
import { matchesExam } from "../src/utils/exams";
import { type PYQQuestion } from "../src/utils/pyq";
import { validateData } from "../src/services/validation";
import { buildCSV } from "../src/services/export";
import { parseExam, parsePolitySource } from "../scripts/import-polity.mjs";

const polity: PYQQuestion[] = JSON.parse(readFileSync(new URL("../src/data/polity-bank.json", import.meta.url), "utf8"));
const originals: PYQQuestion[] = JSON.parse(readFileSync(new URL("../src/data/pyq-bank.json", import.meta.url), "utf8"));
const byId = new Map(polity.map(q => [q.id, q]));
const select = (f: Record<string, string>) => filterQuestions(polity, { ...emptyFilters(), ...f }, new Map(), [], []);

test("all nine source parts are imported without omitted entries or invented official keys", () => {
  assert.equal(polity.length, 1173);
  assert.equal(byId.size, 1173);
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => polity.filter(q => q.sourcePart === i + 1).length), [143,206,71,100,154,240,63,98,98]);
  assert.equal(polity.filter(q => Object.keys(q.options).length === 5).length, 31);
  assert.equal(polity.filter(q => q.answer === "e").length, 6);
  for (const q of polity) {
    assert.equal(q.subject, "Polity & Governance");
    assert.equal(q.questionType, "MCQ"); assert.equal(q.keyStatus, "provided");
    assert.equal(q.verification, "required"); assert.equal(q.marks, 1); assert.equal(q.negativeMarks, 0);
    assert.equal(q.sourceQuestionNumber, q.number);
    assert.match(q.sourceSha256!, /^[a-f0-9]{64}$/);
    assert.ok(q.question.trim()); assert.ok(q.explanation?.justification.trim());
    assert.ok(Object.keys(q.options).includes(q.answer!));
    assert.ok([4,5].includes(Object.keys(q.options).length));
    assert.ok(Object.values(q.options).every(v => v.trim() && !v.includes("✅")));
    assert.equal(q.sourceUrl, ""); assert.equal(q.keyUrl, "");
    assert.deepEqual(q.explanation!.references, []);
  }
});

test("UPSC, State PSC, CDS/CAPF and unknown questions stay separated, with exact occurrence-year matching", () => {
  assert.deepEqual(["UPSC CSE", "State PSC", "CDS & CAPF", "Unlabelled"].map(examGroup => select({ examGroup }).length), [272,571,330,1]);
  const shared = byId.get("polity-part-8-q-047")!;
  assert.equal(matchesExam(shared, { ...emptyFilters(), examGroup: "UPSC CSE", year: "2001" }), true);
  assert.equal(matchesExam(shared, { ...emptyFilters(), examGroup: "UPSC CSE", year: "2004" }), false);
  assert.equal(matchesExam(shared, { ...emptyFilters(), examGroup: "State PSC", state: "Uttar Pradesh", year: "2004", examStage: "Mains" }), true);
  assert.equal(matchesExam(shared, { ...emptyFilters(), examGroup: "State PSC", year: "2001" }), false);
  const dualYear = byId.get("polity-part-1-q-038")!;
  assert.equal(matchesExam(dualYear, { ...emptyFilters(), state: "Madhya Pradesh", year: "1998" }), true);
  assert.equal(matchesExam(dualYear, { ...emptyFilters(), state: "Madhya Pradesh", year: "2010" }), true);
  const unknown = select({ examGroup: "Unlabelled", year: "unknown" });
  assert.equal(unknown[0].id, "polity-part-2-q-067"); assert.equal(unknown[0].year, 0);
  assert.equal(select({ examGroup: "Unlabelled", year: "2025" }).length, 0);
  assert.ok(select({ examGroup: "State PSC", state: "Bihar" }).every(q => q.examOccurrences?.some(e => e.state === "Bihar")));
});

test("provided fifth-choice answers grade correctly and retain their saved key, time and metadata", () => {
  const q = byId.get("polity-part-5-q-101")!;
  const s = startSession([q], "practice", { ...emptyFilters(), examGroup: "State PSC", state: "Chhattisgarh", year: "2016" });
  const r = { ...emptyResponse(), option: "e", seconds: 31.2, submitted: true, confidence: 2, notes: "Revisit the provision", key: keySnapshot(q) };
  s.responses[q.id] = r;
  const changed = { ...q, answer: "a", negativeMarks: 0.5 };
  const report = sessionReport(s, new Map([[q.id, changed]]));
  assert.equal(report.correct, 1); assert.equal(report.score, 1); assert.equal(report.seconds, 31.2);
  const a = responseAttempt(changed, s, r, createEmptyData().subjects);
  assert.equal(a.attempt!.grading, "provided"); assert.equal(a.attempt!.outcome, "correct");
  assert.equal(a.attempt!.answerOption, "e"); assert.equal(a.attempt!.selectedOption, "e");
  assert.equal(a.attempt!.seconds, 31.2); assert.equal(a.attempt!.sourceFile, "POL5.txt");
  assert.equal(a.attempt!.examGroup, "State PSC"); assert.equal(a.attempt!.examName, "CGPSC");
  const data = createEmptyData(); data.pyqs = [a]; data.prelims = { ...emptyPrelims(), session: s };
  const restored = validateData(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.pyqs[0].attempt!.selectedOption, "e");
  assert.equal(restored.prelims!.session!.responses[q.id].key!.negativeMarks, 0);
  for (const column of ["examGroup", "examName", "examState", "examStage", "sourceFile", "examLabels"]) assert.ok(buildCSV(restored, "pyqs").split("\r\n")[0].includes(`"${column}"`));
});

test("source Mains MCQs use objective grading and a shared question records the selected exam occurrence", () => {
  const q = byId.get("polity-part-8-q-047")!;
  for (const [examGroup, year, stage] of [["UPSC CSE","2001","Prelims"], ["State PSC","2004","Mains"]]) {
    const s = startSession([q], "practice", { ...emptyFilters(), examGroup, year });
    const a = responseAttempt(q, s, { ...emptyResponse(), option: q.answer!, key: keySnapshot(q), submitted: true }, createEmptyData().subjects);
    assert.equal(a.year, Number(year)); assert.equal(a.stage, stage);
    assert.equal(a.attempt!.examGroup, examGroup); assert.equal(a.attempt!.outcome, "correct");
    assert.equal(a.attempt!.grading, "provided"); assert.equal(a.attempt!.selfScore, null);
  }
});

test("provided wrong answers have zero practice penalty and large bank sessions preserve original paper membership", () => {
  const qs = polity.slice(0, 2), s = startSession(qs, "test", emptyFilters());
  s.responses[qs[0].id] = { ...emptyResponse(), option: qs[0].answer!, key: keySnapshot(qs[0]) };
  s.responses[qs[1].id] = { ...emptyResponse(), option: qs[1].answer === "a" ? "b" : "a", key: keySnapshot(qs[1]) };
  const report = sessionReport(s, byId);
  assert.equal(report.correct, 1); assert.equal(report.incorrect, 1); assert.equal(report.penalty, 0); assert.equal(report.score, 1);
  const data = createEmptyData();
  data.prelims = { ...emptyPrelims(), session: startSession([...originals, ...polity], "practice", emptyFilters()) };
  assert.equal(validateData(JSON.parse(JSON.stringify(data))).prelims!.session!.questionIds.length, 1353);
  assert.equal(originals.filter(q => q.stage === "Prelims").length, 100);
  assert.equal(originals.filter(q => q.stage === "CSAT").length, 80);
});

test("source parser supports five choices and refuses missing explanations or ambiguous answers", () => {
  const source = "Q1. A bilingual prompt? [Chhattisgarh P.C.S. (Pre) 2016]\n    One\n    Two\n    Three\n    Four\n    Five ✅\nEx: Supplied explanation.\n";
  const q = parsePolitySource(source, "POL5.txt")[0];
  assert.equal(q.answer, "e"); assert.equal(q.options.e, "Five"); assert.equal(q.examOccurrences[0].state, "Chhattisgarh");
  assert.equal(q.explanation.justification, "Supplied explanation.");
  assert.throws(() => parsePolitySource(source.replace("Ex:", "Explanation:"), "POL5.txt"), /Missing explanation/);
  assert.throws(() => parsePolitySource(source.replace("One", "One ✅"), "POL5.txt"), /Ambiguous answer/);
  assert.throws(() => parseExam("MPPCS (Pre) 1998 2010"), /one year/);
  assert.throws(() => parseExam("Unrecognised exam 2016"), /Unrecognised/);
});
