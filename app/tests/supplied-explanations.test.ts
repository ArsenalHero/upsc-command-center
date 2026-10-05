import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { suppliedExplanations, suppliedExplanationsFor } from "../src/data/suppliedExplanations";
import { questionBank, questionById, rawQuestionBank } from "../src/data/questionBank";
import { englishQuestion, englishSourceHTML } from "../src/utils/englishQuestion";
import { buildQuestionCollections } from "../src/utils/questionCollections";
import { explanationStatus } from "../src/utils/explanationReview";
import { matchText, parseExplanationFile, sourceHTMLText, validateSourceHTML } from "../scripts/import-supplied-explanations.mjs";
import groups from "../src/data/duplicate-groups.json";
import reviews from "../src/data/explanation-reviews.json";
import coachingReviews from "../src/data/coaching-explanation-reviews.json";
import type { ExplanationReview } from "../src/utils/pyq";

const audit = JSON.parse(readFileSync(new URL("../docs/SUPPLIED-EXPLANATIONS-IMPORT.json", import.meta.url), "utf8"));
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("all 8,039 supplied explanations and all question/options HTML match the recorded original text hashes", () => {
  assert.equal(suppliedExplanations.length, 8039);
  assert.equal(new Set(suppliedExplanations.map(e => e.id)).size, 8039);
  assert.equal(hash(suppliedExplanations.map(({ id, explanation }) => ({ id, explanation }))), audit.explanationTextSha256);
  assert.equal(hash(suppliedExplanations.map(({ id, question, options }) => ({ id, question, options }))), audit.questionAndOptionTextSha256);
  assert.ok(suppliedExplanations.every(e => e.explanation.trim() && e.questionText.trim()));
  assert.equal(suppliedExplanations.reduce((total, e) => total + (e.explanation.match(/<table>/g) || []).length, 0), 118);
});

test("every question retains its identity, marking and English choices while applying only the reviewed keys", () => {
  const old = buildQuestionCollections(rawQuestionBank, groups, reviews as Record<string, ExplanationReview>);
  const reviewed = buildQuestionCollections(rawQuestionBank, groups, { ...reviews, ...coachingReviews } as Record<string, ExplanationReview>);
  assert.equal(questionBank.length, 7535); assert.equal(questionById.size, old.byId.size);
  for (const [id, before] of old.byId) {
    const after = questionById.get(id)!;
    for (const key of ["id", "marks", "negativeMarks"] as const) assert.deepEqual(after[key], before[key], `${id} ${key}`);
    for (const key of ["answer", "keyStatus", "suppliedAnswer"] as const) assert.deepEqual(after[key], reviewed.byId.get(id)![key], `${id} reviewed ${key}`);
    assert.deepEqual(Object.keys(after.options), Object.keys(before.options));
    assert.ok(!/[\u0900-\u097f]/.test(JSON.stringify({ question: after.question, options: after.options, blocks: after.blocks, explanation: after.explanation, review: after.explanationReview, versions: after.sourceVariants })), id);
    assert.ok(after.question.trim(), id); assert.ok(Object.values(after.options).every(v => v.trim()), id);
  }
});

test("linked explanations use the same option letters and wording without assigning ambiguous or reordered choices", () => {
  let matched = 0;
  for (const q of questionBank) {
    const entries = suppliedExplanationsFor(q);
    if (entries.length) matched++;
    for (const e of entries) assert.deepEqual(e.options.map(([key, html]) => [key.toLowerCase(), matchText(sourceHTMLText(html))]), Object.entries(q.options).map(([key, text]) => [key, matchText(text)]), q.id);
  }
  assert.equal(matched, audit.linkedCanonicalQuestions);
  assert.equal(suppliedExplanationsFor(questionById.get("upsc-2025-prelims-gs1-a-001")!)[0].id, "q-5369");
  assert.equal(suppliedExplanationsFor(questionById.get("culture-heritage-part-1-q-002")!)[0].id, "q-1394");
  assert.equal(explanationStatus(questionById.get("culture-heritage-part-1-q-002")!), "referenced");
  assert.equal(explanationStatus(questionById.get("history-medieval-part-3-q-101")!), "disputed");
});

test("English HTML is unchanged and the two Hindi fragments are removed without dropping their English paragraphs", () => {
  for (const e of suppliedExplanations) {
    const html = englishSourceHTML(e.explanation);
    assert.ok(!/[\u0900-\u097f]/.test(html));
    if (!/[\u0900-\u097f]/.test(e.explanation)) assert.equal(html, e.explanation);
  }
  const kabir = suppliedExplanations.find(e => e.id === "q-1301")!;
  assert.match(englishSourceHTML(kabir.explanation), /Do not ask the sect or caste of a saint/);
  const cheetah = suppliedExplanations.find(e => e.id === "q-7860")!;
  assert.match(englishSourceHTML(cheetah.explanation), /Sanskrit word “Citraka”/);
  const table = englishQuestion({ ...rawQuestionBank[0], question: "Region / क्षेत्र | River / नदी\nAsmaka / अश्मक | Godavari / गोदावरी" });
  assert.equal(table.question, "Region | River\nAsmaka | Godavari");
});

test("the importer accepts static formatting and rejects scripts, event handlers and active links without executing uploaded HTML", () => {
  const safe = "<table><tr><th>Term</th><td><strong>Meaning</strong></td></tr></table>";
  assert.equal(validateSourceHTML(safe), safe);
  for (const value of ["<script>alert(1)</script>", '<p onclick="alert(1)">Text</p>', '<a href="javascript:alert(1)">Link</a>', '<iframe src="https://example.com"></iframe>']) assert.throws(() => validateSourceHTML(value), /Unsupported/);
  const record = { id: "fixture", question: "<p>English question?</p>", options: [["A", "<p>One</p>"]], explanation: safe };
  assert.deepEqual(parseExplanationFile(`<script id="data" type="application/json">${JSON.stringify([record])}</script>`), [record]);
});
