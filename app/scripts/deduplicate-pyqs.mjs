import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const numerals = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };
export function englishText(text) {
  return text.replace(/\[cite:\s*[^\]]*\]/gi, "").split(/\r?\n/).map(line => {
    if (/[\u0900-\u097f]/.test(line)) {
      const segments = line.split(/\s+\/\s+/), pieces = [];
      for (let i = 0; i < segments.length; i++) {
        const part = segments[i];
        if (!/[\u0900-\u097f]/.test(part)) pieces.push((i > 0 && !/[\u0900-\u097f]/.test(segments[i - 1]) ? " / " : " ") + part);
        else for (const section of part.split(/[:：]/)) if (section.trim() && !/[\u0900-\u097f]/.test(section)) pieces.push(" " + section);
      }
      line = pieces.join(" ");
    }
    return line.replace(/👉/g, "").trim();
  }).filter(line => line && !/^choose the correct option[.\s:]*$/i.test(line)).join("\n");
}
export function normalizedText(text, option = false) {
  let value = englishText(text).normalize("NFKC").toLowerCase();
  value = value.replace(/^(\s*)([ivx]+)(?=[.\s:])/gm, (_, space, n) => space + (numerals[n] || n));
  value = value.replace(/\b(statement|list)\s*[-:]?\s*([ivx]+)\b/g, (_, word, n) => word + " " + (numerals[n] || n));
  if (option) value = value.replace(/\b([ivx]+)\b/g, (n) => numerals[n] || n);
  value = value.replace(/(?<=[a-z])[-–—](?=[a-z])/g, " ");
  return (value.match(/\d+(?:\.\d+)?|[a-z]+|[+\-*/=<>%^×÷₹$]/g) || []).join(" ");
}
export function questionFingerprint(q) {
  const passage = (q.blocks || []).filter(b => b.type === "passage").map(b => b.text || "").join("\n");
  return JSON.stringify([normalizedText(q.question), normalizedText(passage), Object.values(q.options).map(value => normalizedText(value, true)).sort()]);
}
export function answerIdentity(text) {
  const value = normalizedText(text, true);
  if (/^(?:\d+|and|only|both|\s)+$/.test(value)) return (value.match(/\d+/g) || []).sort().join(",");
  return value.replace(/^all the /, "all ").replace(/^none of the above(?: statements)?(?: is correct)?$/, "none");
}
export function groupDuplicates(questions, reviewed = []) {
  const index = new Map(), groups = [];
  for (const q of questions) {
    const key = questionFingerprint(q), existing = index.get(key);
    if (existing) existing.push(q.id); else { const group = [q.id]; groups.push(group); index.set(key, group); }
  }
  const byId = new Map(questions.map(q => [q.id, q])), owner = new Map(groups.flatMap(group => group.map(id => [id, group])));
  for (const review of reviewed) {
    if (!review.reason?.trim() || !byId.has(review.canonicalId) || !byId.has(review.duplicateId)) throw new Error("Invalid reviewed duplicate.");
    const target = owner.get(review.canonicalId), duplicate = owner.get(review.duplicateId);
    if (target === duplicate) continue;
    target.push(...duplicate);
    for (const id of duplicate) owner.set(id, target);
    duplicate.length = 0;
  }
  const rank = new Map(questions.map((q, i) => [q.id, i]));
  return groups.filter(group => group.length).map(group => { group.sort((a, b) => rank.get(a) - rank.get(b)); return { canonicalId: group[0], duplicateIds: group.slice(1) }; });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bank = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
  const originals = bank("pyq-bank"), old = [...originals, ...bank("polity-bank"), ...bank("geography-bank"), ...bank("additional-bank")], incoming = bank("history-economy-bank"), questions = [...old, ...incoming];
  const reviews = JSON.parse(readFileSync(new URL("../docs/REVIEWED-DUPLICATES.json", import.meta.url), "utf8"));
  const groups = groupDuplicates(questions, reviews), incomingIds = new Set(incoming.map(q => q.id)), oldIds = new Set(old.map(q => q.id));
  const byId = new Map(questions.map(q => [q.id, q]));
  const duplicates = groups.filter(group => group.duplicateIds.length).map(group => {
    const answers = new Set([group.canonicalId, ...group.duplicateIds].map(id => byId.get(id)).filter(q => q.answer).map(q => answerIdentity(q.options[q.answer])));
    return { ...group, ...(answers.size > 1 ? { keyConflict: true } : {}) };
  });
  writeFileSync(new URL("../src/data/duplicate-groups.json", import.meta.url), JSON.stringify(duplicates, null, 2) + "\n");
  const summary = {
    previousSourceEntries: old.length, uploadedSourceEntries: incoming.length,
    previousUniqueQuestions: groupDuplicates(old, reviews.filter(r => oldIds.has(r.canonicalId) && oldIds.has(r.duplicateId))).length,
    newUniqueQuestions: groups.filter(group => incomingIds.has(group.canonicalId)).length,
    uploadedDuplicates: incoming.length - groups.filter(group => incomingIds.has(group.canonicalId)).length,
    existingDuplicateEntries: groups.flatMap(group => group.duplicateIds).filter(id => oldIds.has(id)).length,
    uniqueBankQuestions: groups.length, duplicateGroups: duplicates.length,
  };
  writeFileSync(new URL("../docs/DEDUPLICATION.json", import.meta.url), JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary));
}
