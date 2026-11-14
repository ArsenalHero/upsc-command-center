import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHistoryEconomySource } from "./import-history-economy.mjs";

export const ancientCultureSources = [
  { file: "AM2.txt", slug: "history-ancient-rulers", title: "Ancient Rulers", subject: "History", topic: "Ancient India · kingdoms & rulers", part: 2, first: 1, last: 129, count: 129, fiveOptions: [113] },
  { file: "AM3.txt", slug: "history-medieval-part-1", title: "Medieval History 1", subject: "History", topic: "Medieval India · regional kingdoms & Delhi Sultanate", part: 1, first: 1, last: 204, count: 203, fiveOptions: [162,163], numbers: Array.from({ length: 204 }, (_, i) => i + 1).filter(n => n !== 30), numberingNote: "The supplied file skips Q30. No missing question has been invented." },
  { file: "gemini-code-1784866808724.txt", slug: "history-medieval-part-2", title: "Medieval History 2", subject: "History", topic: "Medieval India · Vijayanagara, Mughals & regional powers", part: 2, first: 1, last: 100, count: 100 },
  { file: "gemini-code-1784867495529.txt", slug: "history-medieval-part-3", title: "Medieval History 3", subject: "History", topic: "Medieval India · Vijayanagara, Mughals & regional powers", part: 3, first: 101, last: 160, count: 60 },
  { file: "b.txt", slug: "history-medieval-part-4", title: "Medieval History 4", subject: "History", topic: "Medieval India · Vijayanagara, Mughals & regional powers", part: 4, first: 161, last: 200, count: 40, fiveOptions: [193] },
  { file: "gemini-code-1784867515096.txt", slug: "history-medieval-part-5", title: "Medieval History 5", subject: "History", topic: "Medieval India · Vijayanagara, Mughals & regional powers", part: 5, first: 201, last: 235, count: 35 },
  { file: "gemini-code-1784984323628.txt", slug: "culture-religious-traditions", title: "Religious Traditions", subject: "Art & Culture", topic: "Religion & philosophical traditions", part: 1, first: 1, last: 154, count: 154 },
  { file: "AM5.txt", slug: "culture-art-architecture", title: "Art & Architecture", subject: "Art & Culture", topic: "Art, architecture & monuments", part: 5, first: 1, last: 205, count: 205 },
  { file: "am6.txt", slug: "culture-literature-performing-arts", title: "Literature & Performing Arts", subject: "Art & Culture", topic: "Literature, music & performing arts", part: 6, first: 1, last: 215, count: 215 },
  { file: "gemini-code-1784985536086.txt", slug: "culture-heritage-part-1", title: "Cultural Heritage 1", subject: "Art & Culture", topic: "Heritage & cultural traditions", part: 1, first: 1, last: 32, count: 32, numbers: Array.from({ length: 32 }, (_, i) => i === 17 ? 118 : i + 1), numberingNote: "The 18th supplied entry is labelled Q118. Its original label is retained.", numberNotes: { 118: "Source numbering note: this is the 18th entry, but the supplied header reads Q118. The original label is retained." } },
  { file: "gemini-code-1784985669985.txt", slug: "culture-heritage-part-2", title: "Cultural Heritage 2", subject: "Art & Culture", topic: "Heritage & cultural traditions", part: 2, first: 33, last: 70, count: 38 },
  { file: "gemini-code-1784985795056.txt", slug: "culture-heritage-part-3", title: "Cultural Heritage 3", subject: "Art & Culture", topic: "Heritage & cultural traditions", part: 3, first: 71, last: 114, count: 44 },
];

export function parseAncientCultureSource(text, fileName) {
  const source = ancientCultureSources.find(s => s.file === fileName);
  if (!source) throw new Error(`Unexpected source file: ${fileName}`);
  return parseHistoryEconomySource(text, fileName, source);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/import-ancient-culture.mjs <source-directory>");
  const manifest = [], errors = [], questions = [];
  for (const source of ancientCultureSources) {
    try {
      const text = readFileSync(resolve(input, source.file), "utf8"), parsed = parseAncientCultureSource(text, source.file);
      if (parsed.length !== source.count || parsed.at(-1).number !== source.last) throw new Error(`Source count changed: ${source.file}`);
      manifest.push({ ...source, questions: parsed.length, bytes: Buffer.byteLength(text), sha256: parsed[0].sourceSha256 });
      questions.push(...parsed);
    } catch (error) { errors.push(error.message); }
  }
  if (errors.length) { console.error(JSON.stringify(errors)); process.exit(1); }
  writeFileSync(new URL("../src/data/ancient-culture-bank.json", import.meta.url), JSON.stringify(questions, null, 2) + "\n");
  writeFileSync(new URL("../docs/ANCIENT-CULTURE-SOURCES.json", import.meta.url), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ total: questions.length, fiveOptions: questions.filter(q => Object.keys(q.options).length === 5).length, subjects: Object.fromEntries([...new Set(questions.map(q => q.subject))].map(s => [s, questions.filter(q => q.subject === s).length])) }));
}
