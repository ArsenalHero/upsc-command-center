import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseExam } from "./import-polity.mjs";

export const geographySources = [
  { file: "GEO1.txt", part: 1, topic: "Earth & astronomical geography", count: 101, missing: [] },
  { file: "GEO2.txt", part: 2, topic: "Geomorphology", count: 120, missing: [] },
  { file: "GEO3.txt", part: 3, topic: "Oceanography", count: 44, missing: [] },
  { file: "GEO4.txt", part: 4, topic: "Climatology", count: 189, missing: [] },
  { file: "GEO6(1).txt", part: 6, topic: "Indian geography & resources", count: 202, missing: [41] },
  { file: "GEO7(3).txt", part: 7, topic: "World geography & mapping", count: 197, missing: [47, 50, 51, 55, 59, 61] },
];
const norm = text => text.replace(/[^a-z]/gi, "").toUpperCase();
const isExam = text => /UPSC|UPPCS|UPPSC|UPLOWER|UPUDA|UPROARO|MPPCS|BPSC|BPCS|RASRTS|JHARKHANDPCS|UTTARAKHANDPCS|UTTARAKHANDLOWER|CHHATTISGARHPCS|CAPF|CDS/.test(norm(text));

export function parseGeographyExam(label) {
  const n = norm(label);
  if (n.includes("UPROARO") || n.includes("UTTARAKHANDLOWER")) {
    const years = [...label.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m => Number(m[0]));
    if (years.length !== 1) throw new Error(`Exam label needs one year: ${label}`);
    return { group: "State PSC", name: n.includes("UPROARO") ? "UPPSC RO/ARO" : "UKPSC Lower Subordinate", state: n.includes("UPROARO") ? "Uttar Pradesh" : "Uttarakhand", year: years[0], stage: /mains?/i.test(label) ? "Mains" : /pre/i.test(label) ? "Prelims" : "Not supplied", label };
  }
  // A UPSC prefix alone does not make a CDS/CAPF question a CSE question.
  if (n.includes("CAPF") || n.includes("CDS")) return { ...parseExam(label.replace(/^UPSC\s*/i, "")), label };
  return parseExam(label);
}

export function parseGeographySource(text, fileName) {
  const source = geographySources.find(s => s.file === fileName);
  if (!source) throw new Error(`Unexpected source file: ${fileName}`);
  const headers = [...text.matchAll(/^\s*Q\s*(\d+)\.\s*/gm)];
  if (!headers.length || text.slice(0, headers[0].index).replace(/^\uFEFF/, "").trim()) throw new Error(`Invalid question headers in ${fileName}`);
  const sha256 = createHash("sha256").update(text).digest("hex");
  let previous = 0;
  return headers.map((m, i) => {
    const sourceNumber = Number(m[1]);
    if (sourceNumber <= previous || sourceNumber > 1000) throw new Error(`Duplicate or out-of-order numbering at ${fileName} Q${sourceNumber}`);
    previous = sourceNumber;
    const raw = text.slice(m.index + m[0].length, headers[i + 1]?.index ?? text.length).trim();
    const separator = raw.indexOf("Ex:");
    if (separator < 0) throw new Error(`Missing explanation: ${fileName} Q${sourceNumber}`);
    const body = raw.slice(0, separator).trim(), explanation = raw.slice(separator + 3).trim();
    const rawLines = body.split(/\r?\n/).filter(l => l.trim());
    let optionCount = 0;
    for (const line of [...rawLines].reverse()) { if (/^\s{2,}\S/.test(line)) optionCount++; else break; }
    if (![4, 5].includes(optionCount)) throw new Error(`Invalid option boundary: ${fileName} Q${sourceNumber}`);
    const lines = rawLines.map(l => l.trim()), optionLines = lines.slice(-optionCount);
    if (!explanation || optionLines.some(l => l.startsWith("👉"))) throw new Error(`Invalid options/explanation: ${fileName} Q${sourceNumber}`);
    const marked = optionLines.map((l, index) => l.includes("✅") ? index : -1).filter(n => n >= 0);
    if (marked.length !== 1 || (body.match(/✅/g) || []).length !== 1) throw new Error(`Ambiguous answer: ${fileName} Q${sourceNumber}`);
    const tags = [...body.matchAll(/\[([^\]\n]+)\]/g)].filter(m => isExam(m[1]));
    const occurrences = tags.flatMap(m => m[1].replace(/^[-\s]+|[-\s]+$/g, "").split(/,\s*/).map(label => parseGeographyExam(label.trim())));
    if (!occurrences.length || occurrences.length > 2) throw new Error(`Missing or unsupported exam occurrence: ${fileName} Q${sourceNumber}`);
    let question = lines.slice(0, -optionCount).join("\n\n");
    for (const tag of tags) question = question.replaceAll(tag[0], "");
    question = question.replace(/👉\s*/g, "").trim().replace(/\n{3,}/g, "\n\n");
    const options = Object.fromEntries(optionLines.map((l, index) => ["abcde"[index], l.replace(/✅/g, "").replace(/^\([a-e]\)\s*/i, "").trim()]));
    if (!question || Object.values(options).some(v => !v)) throw new Error(`Empty content: ${fileName} Q${sourceNumber}`);
    const primary = occurrences[0];
    return {
      id: `geography-part-${source.part}-q-${String(sourceNumber).padStart(3, "0")}`,
      year: primary.year, stage: primary.stage === "Mains" ? "Mains" : "Prelims", questionType: "MCQ",
      paper: `${primary.name} · Geography MCQs`, number: sourceNumber, booklet: "", subject: "Geography", topic: source.topic,
      question, options, answer: "abcde"[marked[0]], keyStatus: "provided", marks: 1, negativeMarks: 0,
      wordLimit: 0, sourceUrl: "", keyUrl: "", page: 0, verification: "required",
      examOccurrences: occurrences, sourceFile: fileName, sourcePart: source.part, sourceQuestionNumber: sourceNumber, sourceSha256: sha256,
      explanation: { justification: explanation, concept: "", references: [] },
    };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/import-geography.mjs <source-directory>");
  const questions = geographySources.flatMap(source => {
    const parsed = parseGeographySource(readFileSync(resolve(input, source.file), "utf8"), source.file);
    const numbers = new Set(parsed.map(q => q.number)), last = parsed.at(-1).number;
    const missing = Array.from({ length: last }, (_, i) => i + 1).filter(n => !numbers.has(n));
    if (parsed.length !== source.count || JSON.stringify(missing) !== JSON.stringify(source.missing)) throw new Error(`Source counts or numbering changed: ${source.file}`);
    return parsed;
  });
  writeFileSync(new URL("../src/data/geography-bank.json", import.meta.url), JSON.stringify(questions, null, 2) + "\n");
  const counts = {};
  for (const q of questions) for (const group of new Set(q.examOccurrences.map(e => e.group))) counts[group] = (counts[group] || 0) + 1;
  console.log(JSON.stringify({ total: questions.length, counts, sourceCounts: Object.fromEntries(geographySources.map(s => [s.file, questions.filter(q => q.sourceFile === s.file).length])) }, null, 2));
}
