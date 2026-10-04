import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseGeographyExam } from "./import-geography.mjs";

export const additionalSources = [
  { file: "BIODIVERSITY.txt", slug: "environment-biodiversity", title: "Biodiversity", subject: "Environment", topic: "Biodiversity & conservation", part: 1, first: 1, last: 197, count: 197, missing: [] },
  { file: "Climate Change.txt", slug: "environment-climate-change", title: "Climate Change", subject: "Environment", topic: "Climate change", part: 2, first: 1, last: 79, count: 79, missing: [] },
  { file: "Combat Climate Change.txt", slug: "environment-climate-action", title: "Combat Climate Change", subject: "Environment", topic: "Climate action & agreements", part: 3, first: 1, last: 95, count: 95, missing: [] },
  { file: "ENV.txt", slug: "environment-ecology", title: "Ecology & Environment", subject: "Environment", topic: "Ecology & environment", part: 4, first: 1, last: 94, count: 94, missing: [] },
  { file: "Pollution.txt", slug: "environment-pollution", title: "Pollution", subject: "Environment", topic: "Pollution & waste", part: 5, first: 1, last: 132, count: 132, missing: [] },
  { file: "ECO4.txt", slug: "economy-part-4", title: "Economy 4", subject: "Economy", topic: "Development, welfare & government schemes", part: 4, first: 1, last: 135, count: 135, missing: [], unindented: true },
  { file: "ECO5.txt", slug: "economy-part-5", title: "Economy 5", subject: "Economy", topic: "Infrastructure & industries", part: 5, first: 1, last: 98, count: 98, missing: [] },
  { file: "ECO6.txt", slug: "economy-part-6", title: "Economy 6", subject: "Economy", topic: "International trade & institutions", part: 6, first: 1, last: 135, count: 135, missing: [] },
  { file: "ECO7.txt", slug: "economy-part-7", title: "Economy 7", subject: "Economy", topic: "Agriculture & allied sectors", part: 7, first: 1, last: 257, count: 257, missing: [], pending: [147] },
  { file: "GENS1.txt", slug: "science-part-1", title: "General Science 1", subject: "Science & Technology", topic: "General science · collection 1", part: 1, first: 1, last: 311, count: 308, missing: [173, 217, 250], unlabelled: [5] },
  { file: "GENS2.txt", slug: "science-part-2", title: "General Science 2", subject: "Science & Technology", topic: "General science · collection 2", part: 2, first: 312, last: 599, count: 288, missing: [], unindented: true, unlabelled: [330, 497] },
  { file: "GENS3.txt", slug: "science-part-3", title: "General Science 3", subject: "Science & Technology", topic: "General science · collection 3", part: 3, first: 600, last: 919, count: 320, missing: [] },
  { file: "GENS4.txt", slug: "science-part-4", title: "Science & Technology 4", subject: "Science & Technology", topic: "Applied science & technology", part: 4, first: 1, last: 331, count: 331, missing: [], unindented: true },
];
const norm = text => text.replace(/[^a-z]/gi, "").toUpperCase();
const isExam = text => /UPSC|UPPCS|UPPSC|UPLOWER|UPUDA|UPROARO|MPPCS|BPSC|BPCS|RASRTS|JHARKHANDPCS|JPSC|UTTARAKHAND|UTTRAKHAND|CHHATTISGARHPCS|CGPSC|CAPF|CDS/.test(norm(text));

export function parseAdditionalExam(label) {
  const n = norm(label);
  // Incomplete source years remain unknown; never silently turn "017" into 2017.
  if (![...label.matchAll(/\b(?:19|20)\d{2}\b/g)].length) return { ...parseAdditionalExam(label + " 1900"), year: 0, label };
  const special = n.startsWith("CGPSC") ? ["CGPSC", "Chhattisgarh"] : n.startsWith("JPSC") ? ["JPSC", "Jharkhand"] : n.includes("UPPSCRI") ? ["UPPSC RI", "Uttar Pradesh"] : n.includes("UPPSCGIC") ? ["UPPSC GIC", "Uttar Pradesh"] : null;
  if (special) {
    const years = [...label.matchAll(/\b(?:19|20)\d{2}\b/g)];
    if (years.length !== 1) throw new Error(`Exam label needs one year: ${label}`);
    return { group: "State PSC", name: special[0], state: special[1], year: Number(years[0][0]), stage: /mains?/i.test(label) ? "Mains" : /pre/i.test(label) ? "Prelims" : "Not supplied", label };
  }
  return { ...parseGeographyExam(label.replace(/Uttrakhand/gi, "Uttarakhand")), label };
}

export function parseAdditionalOccurrences(label) {
  const repeated = label.match(/^(.*?)(\b(?:19|20)\d{2})\s*&\s*((?:19|20)\d{2})\s*$/);
  if (repeated) return [repeated[2], repeated[3]].map(year => ({ ...parseAdditionalExam(repeated[1] + year), label }));
  return [parseAdditionalExam(label)];
}

export function parseAdditionalSource(text, fileName) {
  const source = additionalSources.find(s => s.file === fileName);
  if (!source) throw new Error(`Unexpected source file: ${fileName}`);
  const headers = [...text.matchAll(/^\s*Q\s*(\d+)\.\s*/gm)];
  if (!headers.length || text.slice(0, headers[0].index).replace(/^\uFEFF/, "").trim()) throw new Error(`Invalid question headers: ${fileName}`);
  const sha256 = createHash("sha256").update(text).digest("hex");
  let previous = 0;
  return headers.map((m, i) => {
    const number = Number(m[1]), where = `${fileName} Q${number}`;
    if (number <= previous || number > 10000) throw new Error(`Duplicate or out-of-order numbering: ${where}`);
    previous = number;
    const raw = text.slice(m.index + m[0].length, headers[i + 1]?.index ?? text.length).trim();
    const separator = raw.indexOf("Ex:");
    if (separator < 0) throw new Error(`Missing explanation: ${where}`);
    const body = raw.slice(0, separator).trim(), explanation = raw.slice(separator + 3).trim();
    const lines = body.split(/\r?\n/).filter(line => line.trim());
    const notes = [];
    while (/^\s*\*\(Note:/i.test(lines.at(-1) || "")) notes.unshift(lines.pop().trim());
    let optionCount = 0;
    for (const line of [...lines].reverse()) {
      if (/^\s{2,}\S/.test(line) || /^\s*\([a-e]\)\s+/i.test(line)) optionCount++; else break;
    }
    if (![4, 5].includes(optionCount) && source.unindented && optionCount <= 2) optionCount = 4;
    if (![4, 5].includes(optionCount)) throw new Error(`Invalid option boundary: ${where}`);
    const optionLines = lines.slice(-optionCount).map(line => line.trim());
    if (optionLines.some(line => line.startsWith("👉") || /^\d+\.\s+\p{L}/u.test(line)) || !explanation) throw new Error(`Invalid options/explanation: ${where}`);
    const marked = optionLines.map((line, index) => line.includes("✅") ? index : -1).filter(index => index >= 0);
    const pending = source.pending?.includes(number);
    if (pending ? marked.length !== 0 || (body.match(/✅/g) || []).length !== 0 : marked.length !== 1 || (body.match(/✅/g) || []).length !== 1) throw new Error(`Ambiguous answer: ${where}`);
    const tags = [...body.matchAll(/\[([^\]\n]+)\]/g)].filter(m => isExam(m[1]));
    const occurrences = tags.flatMap(m => m[1].replace(/^[-\s]+|[-\s]+$/g, "").split(/,\s*/).flatMap(label => parseAdditionalOccurrences(label.trim())));
    if ((!occurrences.length && !source.unlabelled?.includes(number)) || occurrences.length > 3) throw new Error(`Missing/unsupported exam occurrence: ${where}`);
    let question = lines.slice(0, -optionCount).map(line => line.trim()).join("\n\n");
    for (const tag of tags) question = question.replaceAll(tag[0], "");
    question = question.replace(/👉\s*/g, "").trim().replace(/\n{3,}/g, "\n\n");
    const options = Object.fromEntries(optionLines.map((line, index) => ["abcde"[index], line.replace(/✅/g, "").replace(/^\([a-e]\)\s+(?=\S)/i, "").trim()]));
    if (!question || Object.values(options).some(value => !value)) throw new Error(`Empty content: ${where}`);
    const primary = occurrences[0] || { name: "Not supplied", year: 0, stage: "Not supplied" };
    return {
      id: `${source.slug}-q-${String(number).padStart(3, "0")}`, year: primary.year,
      stage: primary.stage === "Mains" ? "Mains" : "Prelims", questionType: "MCQ",
      paper: `${primary.name} · ${source.subject === "Science & Technology" ? "Science" : source.subject} MCQs`,
      number, booklet: "", subject: source.subject, topic: source.topic, question, options,
      answer: pending ? null : "abcde"[marked[0]], keyStatus: pending ? "pending" : "provided", marks: 1, negativeMarks: 0,
      wordLimit: 0, sourceUrl: "", keyUrl: "", page: 0, verification: "required", examOccurrences: occurrences,
      sourceFile: fileName, sourcePart: source.part, sourceTitle: source.title, sourceQuestionNumber: number, sourceSha256: sha256,
      ...(notes.length ? { sourceNotes: notes.join("\n") } : {}),
      explanation: { justification: explanation, concept: "", references: [] },
    };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/import-additional-pyqs.mjs <source-directory>");
  const manifest = [];
  const questions = additionalSources.flatMap(source => {
    const text = readFileSync(resolve(input, source.file), "utf8"), parsed = parseAdditionalSource(text, source.file);
    const numbers = new Set(parsed.map(q => q.number)), missing = Array.from({ length: source.last - source.first + 1 }, (_, i) => i + source.first).filter(n => !numbers.has(n));
    if (parsed.length !== source.count || parsed[0].number !== source.first || parsed.at(-1).number !== source.last || JSON.stringify(missing) !== JSON.stringify(source.missing)) throw new Error(`Source count/numbering changed: ${source.file}`);
    manifest.push({ file: source.file, subject: source.subject, questions: parsed.length, first: source.first, last: source.last, missing, bytes: Buffer.byteLength(text), sha256: parsed[0].sourceSha256 });
    return parsed;
  });
  writeFileSync(new URL("../src/data/additional-bank.json", import.meta.url), JSON.stringify(questions, null, 2) + "\n");
  writeFileSync(new URL("../docs/ADDITIONAL-SOURCES.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ sourceQuestions: questions.length, pendingKeys: questions.filter(q => q.keyStatus === "pending").map(q => q.id), subjects: Object.fromEntries([...new Set(questions.map(q => q.subject))].map(subject => [subject, questions.filter(q => q.subject === subject).length])) }));
}
