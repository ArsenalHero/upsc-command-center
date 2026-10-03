import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const sourceFiles = ["Polity1.txt", ...Array.from({ length: 8 }, (_, i) => `POL${i + 2}.txt`)];
const topics = ["Constitutional history & foundations", "Rights, duties & directive principles", "Constitutional structure & amendments", "Judiciary", "Union & state executive", "Parliament & state legislatures", "Local government", "Public institutions & governance", "Organisations & miscellaneous polity"];
const norm = text => text.replace(/[^a-z]/gi, "").toUpperCase();
const isExam = tag => /UPSC|UPPCS|UPPSC|UPLOWER|UPUDA|MPPCS|BPSC|BPCS|RASRTS|JHARKHANDPCS|UTTARAKHANDPCS|CHHATTISGARHPCS|CAPF|CDS|CSDS/.test(norm(tag));

export function parseExam(label) {
  const n = norm(label), years = [...label.matchAll(/\b(?:19|20)\d{2}\b/g)].map(m => Number(m[0]));
  let group, name, state = "";
  if (n.includes("UPSCCSE") || n.startsWith("UPSC")) { group = "UPSC CSE"; name = "UPSC CSE"; }
  else if (n.includes("CAPF")) { group = "CDS & CAPF"; name = "UPSC CAPF"; }
  else if (n.includes("CDS") || n.includes("CSDS")) { group = "CDS & CAPF"; name = "UPSC CDS"; }
  else {
    group = "State PSC";
    if (n.includes("JHARKHAND")) { state = "Jharkhand"; name = "JPSC"; }
    else if (n.includes("UTTARAKHAND")) { state = "Uttarakhand"; name = "UKPSC"; }
    else if (n.includes("CHHATTISGARH")) { state = "Chhattisgarh"; name = "CGPSC"; }
    else if (n.includes("MPPCS")) { state = "Madhya Pradesh"; name = "MPPSC"; }
    else if (n.includes("BPSC") || n.includes("BPCS")) { state = "Bihar"; name = "BPSC"; }
    else if (n.includes("RASRTS")) { state = "Rajasthan"; name = "RPSC RAS/RTS"; }
    else if (n.startsWith("UP")) {
      state = "Uttar Pradesh";
      name = n.includes("LOWER") ? "UPPSC Lower Subordinate" : n.includes("UDA") ? "UPPSC UDA/LDA" : "UPPCS";
    } else throw new Error(`Unrecognised exam label: ${label}`);
  }
  if (years.length !== 1) throw new Error(`Exam label needs one year: ${label}`);
  return { group, name, state, year: years[0], stage: /mains?/i.test(label) ? "Mains" : /pre/i.test(label) ? "Prelims" : "Not supplied", label };
}

export function parsePolitySource(text, fileName) {
  const part = sourceFiles.indexOf(fileName) + 1;
  if (!part) throw new Error(`Unexpected source file: ${fileName}`);
  const headers = [...text.matchAll(/^\s*Q\s*(\d+)\.\s*/gm)];
  if (!headers.length || text.slice(0, headers[0].index).trim()) throw new Error(`Invalid question headers in ${fileName}`);
  const sha256 = createHash("sha256").update(text).digest("hex");
  return headers.map((m, i) => {
    const sourceNumber = Number(m[1]);
    if (sourceNumber !== i + 1) throw new Error(`Unexpected numbering at ${fileName} Q${sourceNumber}`);
    const raw = text.slice(m.index + m[0].length, headers[i + 1]?.index ?? text.length).trim();
    const separator = raw.indexOf("Ex:");
    if (separator < 0) throw new Error(`Missing explanation: ${fileName} Q${sourceNumber}`);
    const body = raw.slice(0, separator).trim(), explanation = raw.slice(separator + 3).trim();
    const rawLines = body.split(/\r?\n/).filter(l => l.trim());
    let optionCount = 4;
    if (part !== 1) {
      optionCount = 0;
      for (const line of [...rawLines].reverse()) { if (/^\s{2,}\S/.test(line)) optionCount++; else break; }
    }
    if (![4, 5].includes(optionCount)) throw new Error(`Invalid option boundary: ${fileName} Q${sourceNumber}`);
    const lines = rawLines.map(l => l.trim()), optionLines = lines.slice(-optionCount);
    if (optionLines.some(l => l.startsWith("👉")) || !explanation) throw new Error(`Invalid options/explanation: ${fileName} Q${sourceNumber}`);
    const marked = optionLines.map((l, index) => l.includes("✅") ? index : -1).filter(n => n >= 0);
    if (marked.length !== 1 || (body.match(/✅/g) || []).length !== 1) throw new Error(`Ambiguous answer: ${fileName} Q${sourceNumber}`);
    const tags = [...body.matchAll(/\[([^\]\n]+)\]/g)].map(m => m[1].replace(/^[-\s]+|[-\s]+$/g, "")).filter(isExam);
    const occurrences = tags.flatMap(tag => tag.split(/,\s*(?=(?:UPSC|U\.?P\.?|MPPCS|M\.P\.)\s*[A-Za-z.(])/i).map(s => parseExam(s.trim())));
    if (occurrences.length > 2) throw new Error(`Unexpected exam occurrences: ${fileName} Q${sourceNumber}`);
    const primary = occurrences[0];
    let question = lines.slice(0, -optionCount).join("\n\n");
    for (const tag of tags) {
      // Remove only the exam annotation; preserve every question statement and prompt.
      question = question.replace(new RegExp("\\[[-\\s]*" + tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[-\\s]*\\]", "g"), "");
    }
    question = question.replace(/👉\s*/g, "").replace(/^\s+|\s+$/g, "").replace(/\n{3,}/g, "\n\n");
    const options = Object.fromEntries(optionLines.map((l, index) => ["abcde"[index], l.replace(/✅/g, "").replace(/^\([a-e]\)\s*/i, "").trim()]));
    if (!question || Object.values(options).some(v => !v)) throw new Error(`Empty content: ${fileName} Q${sourceNumber}`);
    return {
      id: `polity-part-${part}-q-${String(sourceNumber).padStart(3, "0")}`,
      year: primary?.year || 0, stage: primary?.stage === "Mains" ? "Mains" : "Prelims", questionType: "MCQ",
      paper: `${primary?.name || "Unlabelled"} · Polity MCQs`, number: sourceNumber, booklet: "", subject: "Polity & Governance", topic: topics[part - 1],
      question, options,
      answer: "abcde"[marked[0]], keyStatus: "provided", marks: 1, negativeMarks: 0, wordLimit: 0, sourceUrl: "", keyUrl: "", page: 0, verification: "required",
      examOccurrences: occurrences, sourceFile: fileName, sourcePart: part, sourceQuestionNumber: sourceNumber, sourceSha256: sha256,
      explanation: { justification: explanation, concept: "", references: [] },
    };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/import-polity.mjs <source-directory>");
  const questions = sourceFiles.flatMap(name => parsePolitySource(readFileSync(resolve(input, name), "utf8").replace(/^\uFEFF/, ""), name));
  writeFileSync(new URL("../src/data/polity-bank.json", import.meta.url), JSON.stringify(questions, null, 2) + "\n");
  const counts = {};
  for (const q of questions) for (const group of new Set(q.examOccurrences.map(e => e.group).length ? q.examOccurrences.map(e => e.group) : ["Unlabelled"])) counts[group] = (counts[group] || 0) + 1;
  console.log(JSON.stringify({ total: questions.length, counts, sourceCounts: Object.fromEntries(sourceFiles.map(n => [n, questions.filter(q => q.sourceFile === n).length])) }, null, 2));
}
