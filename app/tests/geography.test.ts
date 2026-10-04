import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createEmptyData } from "../src/data/defaults";
import { geographyBank, originalBank, questionBank } from "../src/data/questionBank";
import { emptyFilters, emptyPrelims, emptyResponse, filterQuestions, keySnapshot, responseAttempt, sessionReport, startSession } from "../src/utils/prelims";
import { matchesExam, questionLabel } from "../src/utils/exams";
import { validateData } from "../src/services/validation";
import { buildCSV } from "../src/services/export";
import { geographySources, parseGeographyExam, parseGeographySource } from "../scripts/import-geography.mjs";

const byId = new Map(geographyBank.map(q => [q.id, q]));
const select = (filters: Record<string, string>) => filterQuestions(geographyBank, { ...emptyFilters(), ...filters }, new Map(), [], []);

test("all six Geography parts retain their source numbers, answers and explanations", () => {
  const sources = JSON.parse(readFileSync(new URL("../docs/GEOGRAPHY-SOURCES.json", import.meta.url), "utf8"));
  assert.equal(geographyBank.length, 853);
  assert.equal(byId.size, 853);
  assert.equal(Object.keys(geographyBank[0].options).length, 4);
  assert.equal(geographyBank.filter(q => Object.keys(q.options).length === 5).length, 8);
  for (const source of geographySources) {
    const qs = geographyBank.filter(q => q.sourceFile === source.file);
    const audit = sources.find((s: { file: string }) => s.file === source.file);
    assert.equal(qs.length, source.count);
    assert.equal(audit.questions, source.count);
    const numbers = new Set(qs.map(q => q.number));
    assert.deepEqual(Array.from({ length: qs.at(-1)!.number }, (_, i) => i + 1).filter(n => !numbers.has(n)), source.missing);
    for (const q of qs) {
      assert.equal(q.subject, "Geography"); assert.equal(q.questionType, "MCQ");
      assert.equal(q.sourcePart, source.part); assert.equal(q.sourceQuestionNumber, q.number);
      assert.equal(q.sourceSha256, audit.sha256);
      assert.equal(q.keyStatus, "provided"); assert.equal(q.verification, "required");
      assert.equal(q.marks, 1); assert.equal(q.negativeMarks, 0);
      assert.ok(q.question.trim()); assert.ok(q.explanation!.justification.trim());
      assert.ok([4, 5].includes(Object.keys(q.options).length));
      assert.ok(q.answer && q.options[q.answer]);
      assert.ok(Object.values(q.options).every(v => v.trim() && !v.includes("✅")));
      assert.ok(q.examOccurrences?.length);
      assert.equal(q.sourceUrl, ""); assert.equal(q.keyUrl, "");
      assert.deepEqual(q.explanation!.references, []);
    }
  }
});

test("Geography is separated by exam and matches the year and state of the same occurrence", () => {
  assert.deepEqual(["UPSC CSE", "State PSC", "CDS & CAPF", "Unlabelled"].map(examGroup => select({ examGroup }).length), [222, 383, 248, 0]);
  const shared = byId.get("geography-part-4-q-107")!;
  assert.equal(matchesExam(shared, { ...emptyFilters(), state: "Rajasthan", year: "1997" }), true);
  assert.equal(matchesExam(shared, { ...emptyFilters(), state: "Rajasthan", year: "2005" }), false);
  assert.equal(matchesExam(shared, { ...emptyFilters(), state: "Uttarakhand", year: "2005" }), true);
  const stages = byId.get("geography-part-6-q-105")!;
  for (const examStage of ["Mains", "Prelims"]) assert.equal(matchesExam(stages, { ...emptyFilters(), examGroup: "State PSC", year: "2005", examStage }), true);
  const s = startSession([shared], "practice", { ...emptyFilters(), state: "Rajasthan", year: "1997" });
  const a = responseAttempt(shared, s, { ...emptyResponse(), option: shared.answer!, key: keySnapshot(shared), submitted: true }, createEmptyData().subjects);
  assert.equal(a.year, 1997); assert.equal(a.attempt!.examName, "RPSC RAS/RTS");
  assert.equal(a.paper, "RPSC RAS/RTS · Geography MCQs");
  assert.match(questionLabel(shared), /Geography · Part 4 Q107/);
});

test("Geography five-choice answers save time, result, subject and a frozen provided key", () => {
  const q = byId.get("geography-part-6-q-126")!;
  const data = createEmptyData(), s = startSession([q], "practice", { ...emptyFilters(), subject: "Geography", examGroup: "State PSC", state: "Bihar", year: "2019" });
  const r = { ...emptyResponse(), option: "e", seconds: 27.4, confidence: 2, notes: "Revise resources", errorType: "Conceptual", submitted: true, review: true, key: keySnapshot(q) };
  s.responses[q.id] = r;
  const changed = { ...q, answer: "e", negativeMarks: 0.5 };
  const a = responseAttempt(changed, s, r, data.subjects);
  const report = sessionReport(s, new Map([[q.id, changed]]));
  assert.equal(report.incorrect, 1); assert.equal(report.penalty, 0); assert.equal(report.seconds, 27.4);
  assert.equal(a.attempt!.outcome, "incorrect"); assert.equal(a.attempt!.answerOption, "d");
  assert.equal(a.attempt!.selectedOption, "e");
  assert.equal(a.attempt!.grading, "provided"); assert.equal(a.attempt!.seconds, 27.4);
  assert.equal(a.attempt!.examState, "Bihar"); assert.equal(a.attempt!.sourceFile, "GEO6(1).txt");
  assert.equal(a.paper, "BPSC · Geography MCQs");
  assert.equal(a.subjectId, data.subjects.find(subject => subject.name === "Geography")!.id);
  data.pyqs = [a]; data.prelims = { ...emptyPrelims(), session: s };
  const restored = validateData(JSON.parse(JSON.stringify(data)));
  assert.equal(restored.pyqs[0].attempt!.selectedOption, "e");
  assert.equal(restored.prelims!.session!.responses[q.id].seconds, 27.4);
  assert.match(buildCSV(restored, "pyqs"), /GEO6\(1\)\.txt/);
});

test("the expanded bank supports a complete 2,206-question saved session and retains original papers", () => {
  assert.equal(questionBank.length, 2206); assert.equal(new Set(questionBank.map(q => q.id)).size, 2206);
  assert.deepEqual(["Prelims", "CSAT"].map(stage => originalBank.filter(q => q.stage === stage).length), [100, 80]);
  const data = createEmptyData();
  data.prelims = { ...emptyPrelims(), session: startSession(questionBank, "practice", emptyFilters()) };
  assert.equal(validateData(JSON.parse(JSON.stringify(data))).prelims!.session!.questionIds.length, 2206);
  const tooMany = Array.from({ length: 5001 }, (_, i) => ({ ...questionBank[0], id: `limit-${i}` }));
  assert.throws(() => startSession(tooMany, "practice", emptyFilters()), /5,000/);
  data.prelims.session!.questionIds = tooMany.map(q => q.id);
  assert.throws(() => validateData(data), /question position/);
});

test("the Geography parser preserves supplied paragraphs, bilingual options and numbering gaps", () => {
  const source = "Q1. 👉 Earth? पृथ्वी? [UPSC CSE (Pre) 2025]\n    One एक\n    Two दो ✅\n    Three तीन\n    Four चार\nEx: Exact explanation.\nअगली पंक्ति।\n\nQ3. Sea? [UPPCS (Mains) 2005, UPPCS (Pre) 2005]\n    A\n    B\n    C\n    D\n    E ✅\nEx: Original second explanation.\n";
  const [a, b] = parseGeographySource(source, "GEO6(1).txt");
  assert.equal(a.question, "Earth? पृथ्वी?"); assert.equal(a.options.b, "Two दो");
  assert.equal(a.answer, "b"); assert.equal(a.explanation.justification, "Exact explanation.\nअगली पंक्ति।");
  assert.equal(b.id, "geography-part-6-q-003"); assert.equal(b.answer, "e");
  assert.equal(b.examOccurrences.length, 2); assert.equal(b.questionType, "MCQ");
  assert.equal(a.sourceSha256, createHash("sha256").update(source).digest("hex"));
});

test("additional Geography exam labels remain State PSC or CDS/CAPF and preserve the original annotation", () => {
  const labels = ["UP RO/ARO (Mains) 2013", "Uttarakhand Lower (Sub.) (Pre) 2010", "UPSC CAPF (AC) 2025", "UPSC CDS (I) 2024"];
  const occurrences = labels.map(parseGeographyExam);
  assert.deepEqual(occurrences.map(e => e.group), ["State PSC", "State PSC", "CDS & CAPF", "CDS & CAPF"]);
  assert.deepEqual(occurrences.map(e => e.label), labels);
  assert.equal(occurrences[0].name, "UPPSC RO/ARO"); assert.equal(occurrences[0].stage, "Mains");
  assert.equal(occurrences[1].state, "Uttarakhand"); assert.equal(occurrences[1].name, "UKPSC Lower Subordinate");
});

test("Geography import rejects missing explanations, ambiguous keys, invalid options and duplicate numbers", () => {
  const source = "Q1. Prompt [UPSC CSE (Pre) 2025]\n    One\n    Two ✅\n    Three\n    Four\nEx: Explanation.\n";
  assert.throws(() => parseGeographySource(source.replace("Ex:", "Explanation:"), "GEO1.txt"), /Missing explanation/);
  assert.throws(() => parseGeographySource(source.replace("One", "One ✅"), "GEO1.txt"), /Ambiguous answer/);
  assert.throws(() => parseGeographySource(source.replace("    Four\n", ""), "GEO1.txt"), /Invalid option boundary/);
  assert.throws(() => parseGeographySource(source + source, "GEO1.txt"), /Duplicate or out-of-order/);
  assert.throws(() => parseGeographySource(source, "GEO5.txt"), /Unexpected source/);
  assert.throws(() => parseGeographySource(source.replace("UPSC CSE (Pre) 2025", "Unrecognised exam 2025"), "GEO1.txt"), /Missing or unsupported exam/);
  assert.throws(() => parseGeographyExam("UP RO/ARO 2013 2014"), /one year/);
});
