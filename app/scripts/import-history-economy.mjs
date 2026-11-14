import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAdditionalExam } from "./import-additional-pyqs.mjs";

export const historyEconomySources = [
  { file: "gemini-code-1784688823622.txt", slug: "history-ancient-part-1", title: "Ancient History 1", subject: "History", topic: "Ancient India", part: 1, first: 1, last: 20, count: 20 },
  { file: "gemini-code-1784688982938.txt", slug: "history-ancient-part-2", title: "Ancient History 2", subject: "History", topic: "Ancient India", part: 2, first: 21, last: 60, count: 40 },
  { file: "gemini-code-1784689091694.txt", slug: "history-ancient-part-3", title: "Ancient History 3", subject: "History", topic: "Ancient India", part: 3, first: 61, last: 100, count: 40 },
  { file: "AM1.txt", slug: "history-ancient-part-4", title: "Ancient History 4", subject: "History", topic: "Ancient India", part: 4, first: 101, last: 251, count: 151, fiveOptions: [203, 204, 205, 206, 207] },
  { file: "Modern1.txt", slug: "history-modern-part-1", title: "Modern History 1", subject: "History", topic: "Modern India · European expansion & colonial rule", part: 1, first: 1, last: 88, count: 88, unlabelled: [55] },
  { file: "Modern2.txt", slug: "history-modern-part-2", title: "Modern History 2", subject: "History", topic: "Modern India · social & religious reform", part: 2, first: 1, last: 199, count: 199 },
  { file: "MH3.txt", slug: "history-modern-part-3", title: "Modern History 3", subject: "History", topic: "Modern India · nationalism & revolutionary movements", part: 3, first: 1, last: 188, count: 188 },
  { file: "MH4.txt", slug: "history-modern-part-4", title: "Modern History 4", subject: "History", topic: "Modern India · Gandhian & mass movements", part: 4, first: 1, last: 285, count: 285, fiveOptions: [261, 262] },
  { file: "MH5.txt", slug: "history-modern-part-5", title: "Modern History 5", subject: "History", topic: "Modern India · constitutional development & independence", part: 5, first: 1, last: 165, count: 165 },
  { file: "MH6.txt", slug: "history-modern-part-6", title: "Modern History 6", subject: "History", topic: "Modern India · people, publications & events", part: 6, first: 1, last: 321, count: 321, pending: [29, 30], fiveOptions: [247, 248] },
  { file: "EC1.txt", slug: "economy-part-1", title: "Economy 1", subject: "Economy", topic: "Economic foundations, growth & national income", part: 1, first: 1, last: 162, count: 162, pending: [120] },
  { file: "ECO2.txt", slug: "economy-part-2", title: "Economy 2", subject: "Economy", topic: "Public finance & fiscal policy", part: 2, first: 1, last: 94, count: 94, fiveOptions: [67] },
  { file: "ECO3.txt", slug: "economy-part-3", title: "Economy 3", subject: "Economy", topic: "Banking, money & financial markets", part: 3, first: 1, last: 199, count: 199 },
];
const isExamTag = text => /UPSC|UPPCS|UPPSC|UPBEO|UPLOWER|UPROARO|UPUDA|MPPCS|MPPSC|BPSC|BPCS|RASRTS|JHARKHAND|JPSC|CGPSC|CHHATTISAGARH|CHHATTISGARH|UTTARANCHAL|UTTARAKHAND|UTTRAKHAND|CAPF|CDS/.test(text.replace(/[^a-z]/gi, "").toUpperCase());

export function historyEconomyExamOccurrences(tag) {
  const clean = tag.replace(/^[-\s]+|[-\s]+$/g, "");
  let previousPrefix = "";
  return clean.split(/\s*,(?![^()]*\))\s*|\s*&\s*/).map(part => {
    const yearOnly = /^\d{4}$/.test(part);
    const full = yearOnly ? previousPrefix + part : part;
    if (!yearOnly) previousPrefix = full.replace(/\b(?:19|20)\d{2}\b.*$/, "");
    const normalized = full.replace(/Uttaranchal|Uttrakhand/gi, "Uttarakhand").replace(/Chhattisagarh/gi, "Chhattisgarh").replace(/M\.?\s*P\.?\s*P\.?\s*S\.?\s*C\.?/gi, "MPPCS");
    const parsed = parseAdditionalExam(normalized);
    if (normalized.replace(/[^a-z]/gi, "").toUpperCase().includes("UPBEO")) parsed.name = "UPPSC BEO";
    if (normalized.replace(/[^a-z]/gi, "").toUpperCase().includes("UTTARAKHANDUDALDA")) parsed.name = "UKPSC UDA/LDA";
    return { ...parsed, label: full };
  });
}

export function parseHistoryEconomySource(text, fileName, source = historyEconomySources.find(s => s.file === fileName)) {
  if (!source) throw new Error(`Unexpected source file: ${fileName}`);
  const headers = [...text.matchAll(/^\s*Q\s*(\d+)\.\s*/gm)];
  if (!headers.length || text.slice(0, headers[0].index).replace(/^\uFEFF/, "").trim()) throw new Error(`Invalid question headers: ${fileName}`);
  const sha256 = createHash("sha256").update(text).digest("hex");
  return headers.map((m, i) => {
    const number = Number(m[1]), where = `${fileName} Q${number}`;
    if (number !== (source.numbers?.[i] ?? source.first + i)) throw new Error(`Unexpected numbering: ${where}`);
    const raw = text.slice(m.index + m[0].length, headers[i + 1]?.index ?? text.length).trim();
    const separator = raw.indexOf("Ex:");
    if (separator < 0) throw new Error(`Missing explanation: ${where}`);
    const body = raw.slice(0, separator).trim(), explanation = raw.slice(separator + 3).trim();
    const lines = body.split(/\r?\n/).filter(l => l.trim()), notes = [];
    while (/^\s*\*?\(Note:/i.test(lines.at(-1) || "")) notes.unshift(lines.pop().trim());
    let count = 0;
    for (const l of [...lines].reverse()) { if (/^\s{2,}\S|^\s*\([a-e]\)\s+/.test(l)) count++; else break; }
    if (![4, 5].includes(count)) count = /none of the above/i.test(lines.at(-1) || "") && /more than one/i.test(lines.at(-1) || "") ? 5 : 4;
    if (source.fiveOptions?.includes(number)) count = 5;
    const choices = lines.slice(-count).map(l => l.trim());
    if (!explanation || choices.some(l => l.startsWith("👉") || /^\d+\.\s+\p{L}/u.test(l))) throw new Error(`Invalid choices: ${where}`);
    const marked = choices.map((l, index) => l.includes("✅") ? index : -1).filter(n => n >= 0);
    const pending = source.pending?.includes(number);
    if ((pending ? marked.length !== 0 : marked.length !== 1) || (body.match(/✅/g) || []).length !== marked.length) throw new Error(`Ambiguous answer: ${where}`);
    const tags = [...body.matchAll(/\[([^\]\n]+)\]/g)].filter(t => isExamTag(t[1]));
    const occurrences = tags.flatMap(t => historyEconomyExamOccurrences(t[1]));
    if ((!occurrences.length && !source.unlabelled?.includes(number)) || occurrences.length > 4) throw new Error(`Missing/unsupported exam label: ${where}`);
    let question = lines.slice(0, -count).map(l => l.trim()).join("\n\n");
    for (const tag of tags) question = question.replaceAll(tag[0], "");
    question = question.replace(/👉\s*/g, "").trim().replace(/\n{3,}/g, "\n\n");
    const options = Object.fromEntries(choices.map((l, index) => ["abcde"[index], l.replace(/✅/g, "").replace(/^\([a-e]\)\s+(?=\S)/i, "").trim()]));
    if (!question || Object.values(options).some(v => !v)) throw new Error(`Empty text: ${where}`);
    const primary = occurrences[0] || { name: "Not supplied", year: 0, stage: "Not supplied" };
    return {
      id: `${source.slug}-q-${String(number).padStart(3, "0")}`, year: primary.year,
      stage: primary.stage === "Mains" ? "Mains" : "Prelims", questionType: "MCQ",
      paper: `${primary.name} · ${source.subject} MCQs`, number, booklet: "", subject: source.subject, topic: source.topic,
      question, options, answer: pending ? null : "abcde"[marked[0]], keyStatus: pending ? "pending" : "provided",
      marks: 1, negativeMarks: 0, wordLimit: 0, sourceUrl: "", keyUrl: "", page: 0, verification: "required",
      examOccurrences: occurrences, sourceFile: fileName, sourcePart: source.part, sourceTitle: source.title,
      sourceQuestionNumber: number, sourceSha256: sha256,
      ...((notes.length || source.numberNotes?.[number]) ? { sourceNotes: [...notes, source.numberNotes?.[number]].filter(Boolean).join("\n") } : {}),
      explanation: { justification: explanation, concept: "", references: [] },
    };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/import-history-economy.mjs <source-directory>");
  const manifest = [], errors = [], questions = [];
  for (const source of historyEconomySources) {
    try {
      const text = readFileSync(resolve(input, source.file), "utf8"), parsed = parseHistoryEconomySource(text, source.file);
      if (parsed.length !== source.count || parsed.at(-1).number !== source.last) throw new Error(`Source count changed: ${source.file}`);
      manifest.push({ ...source, questions: parsed.length, bytes: Buffer.byteLength(text), sha256: parsed[0].sourceSha256 });
      questions.push(...parsed);
    } catch (e) { errors.push(e.message); }
  }
  if (errors.length) { console.error(JSON.stringify(errors)); process.exit(1); }
  writeFileSync(new URL("../src/data/history-economy-bank.json", import.meta.url), JSON.stringify(questions, null, 2) + "\n");
  writeFileSync(new URL("../docs/HISTORY-ECONOMY-SOURCES.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ total: questions.length, pending: questions.filter(q => !q.answer).map(q => q.id), subjects: Object.fromEntries([...new Set(questions.map(q => q.subject))].map(s => [s, questions.filter(q => q.subject === s).length])) }));
}
