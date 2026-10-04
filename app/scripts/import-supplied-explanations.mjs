import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { JSDOM } from "jsdom";
import { englishStudyText } from "../src/utils/explanationReview.ts";

const tags = new Set("p strong em b i u ul ol li br h2 h3 h4 table thead tbody tr th td blockquote a".split(" "));
const dom = new JSDOM("<!doctype html><body></body>");
const document = dom.window.document;
export function validateSourceHTML(value) {
  const template = document.createElement("template");
  template.innerHTML = value;
  for (const element of template.content.querySelectorAll("*")) {
    const tag = element.localName;
    if (!tags.has(tag)) throw new Error(`Unsupported source HTML element: ${tag}`);
    for (const attribute of element.attributes) {
      const allowed = tag === "ol" && attribute.name === "start" && /^\d+$/.test(attribute.value)
        || tag === "a" && attribute.name === "href" && /^https?:\/\//i.test(attribute.value)
        || tag === "a" && attribute.name === "target" && attribute.value === "_blank"
        || tag === "a" && attribute.name === "rel" && attribute.value === "noopener noreferrer";
      if (!allowed) throw new Error(`Unsupported source HTML attribute: ${tag}.${attribute.name}`);
    }
  }
  return value;
}
export function sourceHTMLText(value) {
  const template = document.createElement("template");
  template.innerHTML = value;
  for (const br of template.content.querySelectorAll("br")) br.replaceWith("\n");
  for (const element of template.content.querySelectorAll("p,li,tr,h2,h3,h4,blockquote")) element.append("\n");
  for (const element of template.content.querySelectorAll("th,td")) element.append(" | ");
  return template.content.textContent.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
}
const numerals = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };
export function matchText(value, question = false) {
  value = englishStudyText(value).normalize("NFKC").toLowerCase();
  if (question) value = value.replace(/^\s*(?:\d{1,2}|[ivx]+)[.)]\s+/gm, "").replace(/choose the correct option\s*$/i, "");
  value = value.replace(/\b([ivx]+)\b/g, n => numerals[n] || n);
  return (value.match(/\d+(?:\.\d+)?|[a-z]+|[+\-*/=<>%^×÷₹$]/g) || []).join(" ");
}
export function sourceFingerprint(question, options) {
  return JSON.stringify([matchText(question, true), Object.entries(options).map(([key, value]) => [key.toLowerCase(), matchText(value)])]);
}
export function parseExplanationFile(html) {
  const match = html.match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Missing embedded explanation data.");
  const records = JSON.parse(match[1]);
  if (!Array.isArray(records) || !records.length) throw new Error("Empty explanation collection.");
  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id) || !record.explanation?.trim() || !record.question?.trim() || !record.options?.length) throw new Error(`Invalid explanation record ${record.id}`);
    ids.add(record.id);
    validateSourceHTML(record.question); validateSourceHTML(record.explanation);
    for (const [key, html] of record.options) {
      if (!/^[a-e]$/i.test(key)) throw new Error(`Invalid option ${record.id}`);
      validateSourceHTML(html);
    }
  }
  return records;
}
export function studySubject(record) {
  if (record.subject === "AMAC") return /PHILOSOPHIES|LITERATURE|ARCHITECTURE|MISCELLANEOUS/.test(record.topic) ? "Art & Culture" : "History";
  return ({ "Modern History": "History", "Science and Tech": "Science & Technology", Economics: "Economy", Polity: "Polity & Governance" })[record.subject] || record.subject;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw new Error("Usage: node --import tsx scripts/import-supplied-explanations.mjs <HTML file>");
  const bytes = readFileSync(process.argv[2]), records = parseExplanationFile(bytes.toString("utf8"));
  if (records.length !== 8039) throw new Error(`Expected 8,039 source explanations, found ${records.length}.`);
  const bank = name => JSON.parse(readFileSync(new URL(`../src/data/${name}-bank.json`, import.meta.url), "utf8"));
  const raw = ["pyq", "polity", "geography", "additional", "history-economy", "ancient-culture"].flatMap(bank);
  const groups = JSON.parse(readFileSync(new URL("../src/data/duplicate-groups.json", import.meta.url), "utf8"));
  const canonical = new Map(raw.map(q => [q.id, q.id]));
  for (const group of groups) for (const id of group.duplicateIds) canonical.set(id, group.canonicalId);
  const byId = new Map(raw.map(q => [q.id, q]));
  const index = new Map();
  for (const q of raw) {
    const key = sourceFingerprint(q.question, q.options);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(q.id);
  }
  const matches = {}, linkedSourceIds = new Set();
  for (const record of records) {
    const options = Object.fromEntries(record.options.map(([key, html]) => [key.toLowerCase(), sourceHTMLText(html)]));
    const ids = index.get(sourceFingerprint(sourceHTMLText(record.question), options)) || [];
    const canonicals = new Set(ids.map(id => canonical.get(id)));
    if (canonicals.size !== 1) continue;
    const targets = new Set(ids);
    const canonicalId = [...canonicals][0], primary = byId.get(canonicalId);
    if (JSON.stringify(Object.entries(primary.options).map(([key, value]) => [key, matchText(value)])) === JSON.stringify(Object.entries(options).map(([key, value]) => [key, matchText(value)]))) targets.add(canonicalId);
    for (const id of targets) (matches[id] ||= []).push(record.id);
    linkedSourceIds.add(record.id);
  }
  const chunkSize = 1000;
  const displayRecords = records.map(record => ({ ...record, studySubject: studySubject(record), questionText: sourceHTMLText(record.question) }));
  for (let i = 0; i < Math.ceil(records.length / chunkSize); i++) {
    writeFileSync(new URL(`../src/data/supplied-explanations-${i + 1}-bank.json`, import.meta.url), JSON.stringify(displayRecords.slice(i * chunkSize, (i + 1) * chunkSize), null, 2) + "\n");
  }
  writeFileSync(new URL("../src/data/supplied-explanation-matches.json", import.meta.url), JSON.stringify(matches, null, 2) + "\n");
  const summary = {
    sourceFile: "pyq-problems-and-explanations.html", sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    explanationTextSha256: createHash("sha256").update(JSON.stringify(records.map(({ id, explanation }) => ({ id, explanation })))).digest("hex"),
    questionAndOptionTextSha256: createHash("sha256").update(JSON.stringify(records.map(({ id, question, options }) => ({ id, question, options })))).digest("hex"),
    explanations: records.length, directlyLinkedSourceExplanations: linkedSourceIds.size,
    linkedQuestionIds: Object.keys(matches).length, linkedCanonicalQuestions: Object.keys(matches).filter(id => canonical.get(id) === id).length,
    availableInExplanationLibrary: records.length, existingPracticeQuestions: raw.length - groups.reduce((total, group) => total + group.duplicateIds.length, 0),
    hindiFragmentsRemovedFromDisplay: records.filter(record => /[\u0900-\u097f]/.test(record.explanation)).length,
    matching: "Exact English question text after punctuation/list-marker normalization and identical options in the same letter order; ambiguous matches remain in the complete explanation library.",
    sourceText: "All source question, option and explanation HTML is preserved exactly in the imported data. Display removes Hindi fragments only. No editorial rewriting or additional option review panels.",
  };
  writeFileSync(new URL("../docs/SUPPLIED-EXPLANATIONS-IMPORT.json", import.meta.url), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary));
  dom.window.close();
}
