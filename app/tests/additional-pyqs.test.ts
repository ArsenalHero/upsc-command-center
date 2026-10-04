import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { additionalBank, canonicalQuestionId, canonicalRecords, latestBankAttempts, originalBank, questionBank, questionById, rawQuestionBank } from "../src/data/questionBank";
import { createEmptyData } from "../src/data/defaults";
import { emptyFilters, emptyPrelims, emptyResponse, filterQuestions, keySnapshot, responseAttempt, sessionReport, startSession } from "../src/utils/prelims";
import { matchesSubject } from "../src/utils/questionCollections";
import { matchesExam, questionLabel } from "../src/utils/exams";
import { validateData } from "../src/services/validation";
import { additionalSources, parseAdditionalExam, parseAdditionalOccurrences, parseAdditionalSource } from "../scripts/import-additional-pyqs.mjs";
import { answerIdentity, englishText, groupDuplicates, questionFingerprint } from "../scripts/deduplicate-pyqs.mjs";

const rawById = new Map(rawQuestionBank.map(q => [q.id, q]));

test("all 13 supplied files preserve 2,469 questions, numbering, explanations and provenance", () => {
  const manifest = JSON.parse(readFileSync(new URL("../docs/ADDITIONAL-SOURCES.json", import.meta.url), "utf8"));
  assert.equal(additionalBank.length, 2469);
  assert.deepEqual(["Environment", "Economy", "Science & Technology"].map(subject => additionalBank.filter(q => q.subject === subject).length), [597, 625, 1247]);
  assert.equal(additionalBank.filter(q => Object.keys(q.options).length === 5).length, 71);
  for (const source of additionalSources) {
    const qs = additionalBank.filter(q => q.sourceFile === source.file), audit = manifest.find((s: { file: string }) => s.file === source.file);
    assert.equal(qs.length, source.count); assert.equal(qs[0].number, source.first); assert.equal(qs.at(-1)!.number, source.last);
    const numbers = new Set(qs.map(q => q.number));
    assert.deepEqual(Array.from({ length: source.last - source.first + 1 }, (_, i) => i + source.first).filter(n => !numbers.has(n)), source.missing);
    for (const q of qs) {
      assert.equal(q.sourceSha256, audit.sha256); assert.equal(q.sourceQuestionNumber, q.number);
      assert.ok(q.question.trim()); assert.ok(q.explanation!.justification.trim());
      assert.ok([4, 5].includes(Object.keys(q.options).length)); assert.ok(Object.values(q.options).every(value => value.trim() && !value.includes("✅")));
      assert.equal(q.marks, 1); assert.equal(q.negativeMarks, 0); assert.equal(q.verification, "required");
      assert.equal(q.sourceUrl, ""); assert.equal(q.keyUrl, "");
      assert.equal(q.keyStatus, q.id === "economy-part-7-q-147" ? "pending" : "provided");
    }
  }
});

test("the visible bank removes repeated entries while preserving every raw ID and source version", () => {
  assert.equal(rawQuestionBank.length, 7882); assert.equal(questionBank.length, 7536);
  assert.equal(new Set(questionBank.map(q => questionFingerprint(q) )).size, 7536);
  const old = new Set(rawQuestionBank.slice(0, 2206).map(q => q.id));
  const additionalIds = new Set(additionalBank.map(q => q.id));
  assert.equal(questionBank.filter(q => !old.has(q.id) && additionalIds.has(q.id)).length, 2386);
  assert.equal(additionalBank.filter(q => canonicalQuestionId(q.id) !== q.id).length, 83);
  for (const q of rawQuestionBank) {
    assert.ok(questionById.has(q.id));
    const canonical = questionById.get(canonicalQuestionId(q.id))!;
    assert.ok(questionBank.includes(canonical));
    if (canonical.id !== q.id) assert.ok(canonical.sourceVariants!.some(copy => copy.id === q.id && copy.explanation?.justification === q.explanation?.justification));
  }
});

test("duplicate comparison keeps all table cells and distinguishes changed numbers, negations, math and choices", () => {
  assert.match(englishText("I. Cassava / कसावा : Woody shrub / लकड़ी वाली झाड़ी"), /Cassava.*Woody shrub/);
  const q = { question: "Which value is 1 + 2?", options: { a: "1", b: "2", c: "3", d: "4" } };
  for (const question of ["Which value is 1 - 2?", "Which value is not 1 + 2?", "Which value is 1 + 3?", "Which value is 1 / 2?"]) assert.notEqual(questionFingerprint(q), questionFingerprint({ ...q, question }));
  assert.notEqual(questionFingerprint(q), questionFingerprint({ ...q, options: { ...q.options, d: "5" } }));
  const bilingual = { question: "Which value is 1 + 2? / कौन सा मान है?[cite: 1]", options: { d: "4 / चार", c: "3 / तीन", b: "2 / दो", a: "1 / एक" } };
  assert.equal(questionFingerprint(q), questionFingerprint(bilingual));
  assert.notEqual(questionFingerprint({ ...q, question: "I. Cassava / कसावा : Woody shrub / लकड़ी वाली झाड़ी" }), questionFingerprint({ ...q, question: "I. Cassava / कसावा : Herb / शाक" }));
  assert.equal(answerIdentity("I and II only"), answerIdentity("Both 1 and 2"));
  assert.notEqual(answerIdentity("Only two"), answerIdentity("All three"));
  const groups = groupDuplicates([{ ...q, id: "first" }, { ...bilingual, id: "copy" }]);
  assert.deepEqual(groups, [{ canonicalId: "first", duplicateIds: ["copy"] }]);
});

test("original 2025 papers keep official wording, options, keys and marking when source copies disagree", () => {
  assert.deepEqual(["Prelims", "CSAT"].map(stage => originalBank.filter(q => q.stage === stage).length), [100, 80]);
  for (const q of originalBank) {
    const current = questionById.get(q.id)!;
    for (const field of ["question", "options", "answer", "keyStatus", "marks", "negativeMarks", "blocks"] as const) assert.deepEqual(current[field], q[field]);
  }
  const source = rawById.get("science-part-4-q-010")!, canonical = questionById.get(canonicalQuestionId(source.id))!;
  assert.equal(canonical.id, "upsc-2025-prelims-gs1-a-083"); assert.equal(canonical.keyStatus, "official");
  assert.equal(canonical.keyConflict, true); assert.ok(canonical.sourceVariants!.some(copy => copy.id === source.id));
});

test("merged questions retain subject membership and match each exam/year occurrence together", () => {
  const q = questionById.get(canonicalQuestionId("economy-part-4-q-003"))!;
  assert.equal(matchesSubject(q, "Economy"), true); assert.equal(matchesSubject(q, "Environment"), true);
  const dual = questionById.get(canonicalQuestionId("environment-ecology-q-035"))!;
  for (const year of ["2020", "2021"]) assert.equal(matchesExam(dual, { ...emptyFilters(), examGroup: "State PSC", state: "Uttar Pradesh", year }), true);
  assert.equal(matchesExam(dual, { ...emptyFilters(), state: "Bihar", year: "2020" }), false);
  const state = filterQuestions(questionBank, { ...emptyFilters(), subject: "Environment", examGroup: "State PSC" }, new Map(), [], []);
  assert.equal(state.length, 276);
  assert.match(questionLabel(dual, { year: "2020" }), /2020/);
});

test("existing duplicate session IDs, timed responses and historical grading survive grouping and backup", () => {
  const original = rawById.get("geography-part-4-q-001")!;
  assert.notEqual(canonicalQuestionId(original.id), original.id);
  const data = createEmptyData(), s = startSession([original], "practice", { ...emptyFilters(), subject: "Geography" });
  const response = { ...emptyResponse(), option: original.answer!, seconds: 31, submitted: true, key: keySnapshot(original) };
  s.responses[original.id] = response;
  const record = responseAttempt(original, s, response, data.subjects); data.pyqs = [record]; data.prelims = { ...emptyPrelims(), session: s, bookmarks: [original.id] };
  const before = JSON.stringify(data), restored = validateData(JSON.parse(before));
  assert.equal(restored.prelims!.session!.questionIds[0], original.id); assert.equal(restored.pyqs[0].attempt!.seconds, 31);
  assert.equal(sessionReport(s, questionById).score, 1);
  assert.equal(canonicalRecords(restored.pyqs)[0].attempt!.questionId, canonicalQuestionId(original.id));
  assert.equal(latestBankAttempts(restored.pyqs).size, 1); assert.equal(JSON.stringify(data), before);
});

test("an unmarked source answer saves choice and time without inventing a wrong result", () => {
  const q = questionById.get("economy-part-7-q-147")!, data = createEmptyData(), s = startSession([q], "practice", emptyFilters());
  assert.equal(q.answer, null); assert.match(q.sourceNotes!, /transcription errors/);
  const r = { ...emptyResponse(), option: "b", seconds: 23, submitted: true, key: keySnapshot(q) }; s.responses[q.id] = r;
  const record = responseAttempt(q, s, r, data.subjects), report = sessionReport(s, questionById);
  assert.equal(record.attempt!.outcome, "ungraded"); assert.equal(record.revisionNeeded, false);
  assert.equal(report.incorrect, 0); assert.equal(report.correct, 0); assert.equal(report.ungraded, 1); assert.equal(report.accuracy, null); assert.equal(report.seconds, 23);
});

test("additional parser supports unindented choices, option codes, incomplete years and paired years", () => {
  const source = "Q1. Prompt [UPSC CSE Pre 2025]\nChoice A\nChoice B ✅\nChoice C\nChoice D\nEx: Supplied explanation.\n";
  const q = parseAdditionalSource(source, "GENS4.txt")[0]; assert.equal(q.answer, "b"); assert.equal(q.options.b, "Choice B");
  assert.throws(() => parseAdditionalSource(source.replace("Ex:", "Explanation:"), "GENS4.txt"), /Missing explanation/);
  assert.throws(() => parseAdditionalSource(source.replace("Choice A", "Choice A ✅"), "GENS4.txt"), /Ambiguous answer/);
  assert.equal(parseAdditionalExam("U.P.P.C.S. (Pre) 017").year, 0);
  assert.deepEqual(parseAdditionalOccurrences("UPPCS (Pre) 2021 & 2020").map(e => e.year), [2021, 2020]);
  assert.equal(rawById.get("economy-part-7-q-206")!.options.b, "(b)");
  assert.equal(rawById.get("science-part-2-q-330")!.year, 0);
});

test("the expanded unique bank can be saved and resumed as one filtered session", () => {
  const data = createEmptyData(); data.prelims = { ...emptyPrelims(), session: startSession(questionBank, "practice", emptyFilters()) };
  assert.equal(validateData(JSON.parse(JSON.stringify(data))).prelims!.session!.questionIds.length, 7536);
});
