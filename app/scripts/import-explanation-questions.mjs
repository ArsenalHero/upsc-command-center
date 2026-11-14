import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { englishStudyText } from "../src/utils/explanationReview.ts";
import { sourceHTMLText, validateSourceHTML, matchText } from "./import-supplied-explanations.mjs";
import { questionFingerprint } from "./deduplicate-pyqs.mjs";

const names = ["pyq", "polity", "geography", "additional", "history-economy", "ancient-culture"];
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const hash = value => createHash("sha256").update(value).digest("hex");
const dom = new JSDOM("<!doctype html><body></body>");
const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
const clean = value => englishStudyText(value).replace(/\[(?!Image:)[^\]\n]*\b(?:19|20)\d{2}\b[^\]\n]*\]/gi, "").trim();

// The book's outer <ol start=...> numbers questions, not statements.
// Reconstruct statement labels separately; retain both columns of matching tables.
export function sourceQuestionBlocks(html) {
  validateSourceHTML(html);
  const template = dom.window.document.createElement("template"); template.innerHTML = html;
  const blocks = []; let firstQuestion = true, nextStatement = 1;
  const text = node => clean(sourceHTMLText(node.innerHTML));
  for (const node of template.content.children) {
    if (node.localName === "table") {
      const rows = [...node.querySelectorAll("tr")];
      const header = rows[0]?.querySelector("th") ? rows.shift() : undefined;
      const headers = header ? [...header.children].map(text) : [];
      const values = rows.map(row => [...row.children].map(text));
      if (headers[1] && /list\s*[-–]?\s*(?:II|2)/i.test(headers[1]) && values.length >= 3
        && values.filter(row => /^[A-D][.)]?\s/i.test(row[0])).length >= 3
        && values.every(row => !/^\d+[.)]\s/.test(row[1] || ""))) {
        values.forEach((row, i) => { if (row[1]) row[1] = `${i + 1}. ${row[1]}`; });
      }
      blocks.push({ type: "table", headers, rows: values });
    } else if (node.localName === "ol") {
      const items = [];
      const flush = () => { if (items.length) blocks.push({ type: "list", items: items.splice(0) }); };
      for (const li of [...node.children].filter(child => child.localName === "li")) {
        const value = text(li); if (!value) continue;
        if (firstQuestion) {
          firstQuestion = false; blocks.push({ type: "paragraph", text: value });
          const explicit = [...value.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+(?=[A-Za-z])/g)].map(m => Number(m[1]));
          if (explicit.length) nextStatement = Math.max(...explicit) + 1;
          continue;
        }
        const lines = value.split("\n"), instruction = lines.findIndex(line => /^(?:select|which|how many|choose|codes?)\b/i.test(line));
        const body = (instruction < 0 ? lines : lines.slice(0, instruction)).join("\n");
        if (body) {
          const marker = body.match(/^(\d{1,2}|I{1,3}|IV|V|VI)[.)]\s+/);
          const number = marker ? Number(marker[1]) || roman[marker[1]] : nextStatement;
          items.push(marker ? body : `${number}. ${body}`); nextStatement = number + 1;
        }
        if (instruction >= 0) { flush(); blocks.push({ type: "paragraph", text: lines.slice(instruction).join("\n") }); }
      }
      flush();
    } else {
      const value = text(node); if (value) blocks.push({ type: "paragraph", text: value });
    }
  }
  return blocks;
}
export const blocksText = blocks => blocks.map(b => b.type === "table" ? [b.headers.join(" | "), ...b.rows.map(row => row.join(" | "))].join("\n") : b.type === "list" ? b.items.join("\n") : b.text).join("\n\n");

const exams = {
  "UPSC CSE": ["UPSC CSE", "UPSC CSE", ""], CDS: ["CDS & CAPF", "UPSC CDS", ""], CAPF: ["CDS & CAPF", "UPSC CAPF", ""],
  "UPPSC PCS": ["State PSC", "UPPCS", "Uttar Pradesh"], BPSC: ["State PSC", "BPSC", "Bihar"], "RAS/RTS": ["State PSC", "RPSC RAS/RTS", "Rajasthan"],
  MPPSC: ["State PSC", "MPPSC", "Madhya Pradesh"], "CGPSC / Chhattisgarh PCS": ["State PSC", "CGPSC", "Chhattisgarh"],
  "UKPSC / Uttarakhand PCS": ["State PSC", "UKPSC", "Uttarakhand"], "JPSC / Jharkhand PCS": ["State PSC", "JPSC", "Jharkhand"],
  "UP Lower Subordinate": ["State PSC", "UPPSC Lower Subordinate", "Uttar Pradesh"], "UP RO/ARO": ["State PSC", "UPPSC RO/ARO", "Uttar Pradesh"],
  "UP UDA/LDA": ["State PSC", "UPPSC UDA/LDA", "Uttar Pradesh"], "UP GIC": ["State PSC", "UPPSC GIC", "Uttar Pradesh"], "UP BEO": ["State PSC", "UPPSC BEO", "Uttar Pradesh"],
  "UP RI": ["State PSC", "UPPSC RI", "Uttar Pradesh"], "Uttarakhand Lower Subordinate": ["State PSC", "UKPSC Lower Subordinate", "Uttarakhand"],
};
export function sourceExamOccurrence(entry) {
  const exam = exams[entry.exam], year = Number(entry.year);
  if (!exam || !/^(?:19|20)\d{2}$/.test(entry.year) || year > 2025) throw new Error(`Missing PYQ attribution: ${entry.id}`);
  const tags = [...entry.questionText.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]).filter(tag => tag.includes(entry.year));
  const stage = tags.some(tag => /mains?/i.test(tag)) ? "Mains" : tags.some(tag => /\bpre(?:lims)?\b/i.test(tag)) ? "Prelims" : entry.exam === "UPSC CSE" ? "Prelims" : "Not supplied";
  return { group: exam[0], name: exam[1], state: exam[2], year, stage, label: tags[0] || `${entry.exam} ${entry.year}` };
}
export function sourceQuestion(entry, sourceSha256) {
  validateSourceHTML(entry.question); validateSourceHTML(entry.explanation);
  const options = Object.fromEntries(entry.options.map(([key, html]) => [key.toLowerCase(), clean(sourceHTMLText(validateSourceHTML(html)))]));
  if (![4, 5].includes(Object.keys(options).length) || Object.values(options).some(v => !v) || new Set(Object.values(options).map(value => matchText(value))).size !== Object.keys(options).length) throw new Error(`Incomplete choices: ${entry.id}`);
  if (!options[entry.answer.toLowerCase()]) throw new Error(`Missing answer choice: ${entry.id}`);
  if (/\[Image:|given (?:map|diagram|figure)|figures? given|graph given|following diagram/i.test(entry.questionText)) throw new Error(`Missing diagram: ${entry.id}`);
  const blocks = sourceQuestionBlocks(entry.question), occurrence = sourceExamOccurrence(entry);
  const number = Number(entry.question.match(/<ol start="(\d+)"/)?.[1] || 1);
  const topic = entry.topic.toLowerCase().replace(/\b\w/g, s => s.toUpperCase()).replace(/\bAnd\b/g, "and");
  return { id: `supplied-pyq-${entry.id}`, year: occurrence.year, stage: occurrence.stage === "Mains" ? "Mains" : "Prelims", questionType: "MCQ", paper: `${occurrence.name} · ${entry.studySubject} MCQs`,
    number, booklet: "", subject: entry.studySubject, topic, question: blocksText(blocks), blocks, options, answer: entry.answer.toLowerCase(), keyStatus: "provided",
    marks: 1, negativeMarks: 0, wordLimit: 0, sourceUrl: "", keyUrl: "", page: 0, verification: "required", examOccurrences: [occurrence],
    sourceFile: "pyq-problems-and-explanations.html", sourcePart: 1, sourceTitle: topic, sourceQuestionNumber: number, sourceSha256,
    suppliedExplanationIds: [entry.id], explanation: { justification: clean(sourceHTMLText(entry.explanation)), concept: topic, references: [] },
  };
}

export function reconcileQuestions(entries, decisions, baseline, sourceSha256) {
  const questions = [], byFingerprint = new Map(baseline.map(q => [questionFingerprint(q), q.id])), records = {};
  for (const entry of entries) {
    const decision = decisions[entry.id]; if (!decision) throw new Error(`Unreviewed source entry: ${entry.id}`);
    if (decision.status !== "eligible") { records[entry.id] = decision; continue; }
    const q = sourceQuestion(entry, sourceSha256), key = questionFingerprint(q), existing = byFingerprint.get(key);
    if (existing) {
      const added = questions.find(q => q.id === existing);
      if (added) {
        if (added.answer !== q.answer || JSON.stringify(added.options) !== JSON.stringify(q.options)) throw new Error(`Review repeated choices/key before merging ${entry.id}`);
        added.suppliedExplanationIds.push(entry.id);
        for (const occurrence of q.examOccurrences) if (!added.examOccurrences.some(e => JSON.stringify(e) === JSON.stringify(occurrence))) added.examOccurrences.push(occurrence);
      }
      records[entry.id] = { status: "repeat", questionIds: [existing] }; continue;
    }
    byFingerprint.set(key, q.id); questions.push(q); records[entry.id] = { status: "added", questionIds: [q.id] };
  }
  return { questions, records };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const review = read("../docs/EXPLANATION-QUESTION-REVIEW.json");
  const entries = Array.from({ length: 9 }, (_, i) => read(`../src/data/supplied-explanations-${i + 1}-bank.json`)).flat();
  if (hash(JSON.stringify(entries.map(({ id, question, options }) => ({ id, question, options })))) !== review.questionAndOptionTextSha256) throw new Error("The reviewed source has changed.");
  const baseline = names.flatMap(name => {
    const bytes = readFileSync(new URL(`../src/data/${name}-bank.json`, import.meta.url));
    if (hash(bytes) !== review.baselineSha256[name]) throw new Error(`Review changed baseline: ${name}`);
    return JSON.parse(bytes.toString());
  });
  const { questions, records } = reconcileQuestions(entries, review.records, baseline, review.sourceSha256);
  const matches = read("../src/data/supplied-explanation-matches.json");
  for (const id of Object.keys(matches)) if (id.startsWith("supplied-pyq-")) delete matches[id];
  for (const q of questions) matches[q.id] = q.suppliedExplanationIds;
  const counts = Object.fromEntries([...new Set(Object.values(records).map(r => r.status))].map(status => [status, Object.values(records).filter(r => r.status === status).length]));
  const summary = { reviewedOn: "2026-10-05", explanationEntries: entries.length, previousUniqueQuestions: 7535, addedUniqueQuestions: questions.length,
    uniqueBankQuestions: 7535 + questions.length, classifications: counts,
    subjects: Object.fromEntries([...new Set(questions.map(q => q.subject))].sort().map(subject => [subject, questions.filter(q => q.subject === subject).length])),
    examGroups: Object.fromEntries([...new Set(questions.flatMap(q => q.examOccurrences.map(e => e.group)))].map(group => [group, questions.filter(q => q.examOccurrences.some(e => e.group === group)).length])),
    explanationPolicy: "Original explanation HTML and option letters are retained. New keys are supplied keys, not claimed official keys. Missing attribution, missing diagrams, truncated questions and ambiguous/repeated choices are held outside practice.",
  };
  writeFileSync(new URL("../src/data/explanation-gap-bank.json", import.meta.url), JSON.stringify(questions, null, 2) + "\n");
  writeFileSync(new URL("../src/data/supplied-explanation-matches.json", import.meta.url), JSON.stringify(matches, null, 2) + "\n");
  writeFileSync(new URL("../docs/EXPLANATION-QUESTION-IMPORT.json", import.meta.url), JSON.stringify(summary, null, 2) + "\n");
  writeFileSync(new URL("../docs/EXPLANATION-QUESTION-RECONCILIATION.json", import.meta.url), JSON.stringify(records, null, 2) + "\n");
  console.log(JSON.stringify(summary)); dom.window.close();
}
