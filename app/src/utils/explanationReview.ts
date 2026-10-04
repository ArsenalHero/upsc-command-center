import type { PYQQuestion, StudyExplanation } from "./pyq";

export const cleanStudyText = (text: string) => text.replace(/\[cite:\s*[^\]]*\]/gi, "").replace(/\/n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
export function englishStudyText(text: string) {
  return cleanStudyText(text).split(/\r?\n/).map(line => line.split(/\s*\|\s*/).map(cell => {
    if (!/[\u0900-\u097f]/.test(cell)) {
      const parts = cell.split(/\s+\/\s+/);
      return parts.length === 2 && parts[0].trim() === parts[1].trim() ? parts[0].trim() : cell.trim();
    }
    return cell.split(/\s+\/\s+/).filter(part => !/[\u0900-\u097f]/.test(part)).join(" / ").trim();
  }).filter(Boolean).join(" | ")).filter(Boolean).join("\n");
}
export const studyExplanation = (q: PYQQuestion): StudyExplanation | undefined => q.explanationReview?.explanation || q.explanation;
export const explanationStatus = (q: PYQQuestion) => q.explanationReview?.status === "disputed" || q.keyConflict && q.keyStatus !== "official" ? "disputed" : q.suppliedExplanationIds?.length ? "source" : q.explanationReview?.status === "referenced" ? "referenced" : "source";
export const explanationStatusLabel = (q: PYQQuestion) => explanationStatus(q) === "source" && q.suppliedExplanationIds?.length ? "Supplied HTML explanation" : ({ disputed: "Answer needs review", referenced: "Reference-reviewed explanation", source: "Explanation needs verification" })[explanationStatus(q)];
const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
const tokens = (s: string) => new Set(englishStudyText(s).toLowerCase().match(/[a-z]{3,}/g) || []);
const stop = new Set("the and for from that this with which above only both none all correct incorrect following statement statements given answer option options not are was were has have had been their its into one two three four these those".split(" "));
const meaningful = (s: string) => [...tokens(s)].filter(t => !stop.has(t));
export function listedStatements(q: PYQQuestion) {
  return englishStudyText(q.question).split(/\n/).map(line => line.match(/^\s*(\d+|[IVX]+)[.)]\s+(.+)$/i)).filter((m): m is RegExpMatchArray => !!m).map(m => ({ number: Number(m[1]) || roman[m[1].toLowerCase()], text: m[2] })).filter(s => s.number && s.number <= 6);
}
function selection(text: string, count: number): number[] | null {
  const value = englishStudyText(text).toLowerCase().replace(/\b(i|ii|iii|iv|v|vi)\b/g, n => String(roman[n]));
  if (/neither|none/.test(value)) return [];
  if (/^all(?:\s+of)?(?:\s+the)?\s+(?:above|statements|three|four|five|six)|^all$/.test(value)) return Array.from({ length: count }, (_, i) => i + 1);
  if (/^both(?:\s+of)?(?:\s+the)?\s+(?:above|statements)$/.test(value)) return count === 2 ? [1, 2] : null;
  if (!/^(?:\d+|and|only|both|statement[s]?|[,\s])+[.]?$/.test(value)) return null;
  const ns = [...new Set((value.match(/\d+/g) || []).map(Number))];
  return ns.length && ns.every(n => n <= count && n > 0) ? ns.sort((a, b) => a - b) : null;
}
function sentenceEvidence(text: string, target: string) {
  const words = meaningful(target);
  if (!words.length) return "";
  const sentences = englishStudyText(text).split(/(?<=[.!?])\s+|\n/).filter(s => s.trim());
  return sentences.filter(s => {
    const found = tokens(s), overlap = words.filter(w => found.has(w)).length;
    return overlap >= Math.min(2, words.length) && overlap / words.length >= .45;
  }).join(" ");
}
export interface OptionReview { key: string; text: string; reason: string; basis: "reference" | "source" | "code" | "missing" }
function countChoice(text: string, count: number): number | null {
  const value = englishStudyText(text).toLowerCase().replace(/[.]/g, "").trim();
  if (/^(?:none|none of the above|zero)$/.test(value)) return 0;
  if (/^all(?:\s+(?:the|of|above|given|four|three|five|six|statements|pairs|entries))*$/.test(value)) return count;
  const match = value.match(/^(?:only\s+)?(one|two|three|four|five|six|\d+)(?:\s+(?:pair|statement|entry)s?)?$/);
  if (!match) return null;
  return ({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 } as Record<string, number>)[match[1]] ?? Number(match[1]);
}
export function optionReviews(q: PYQQuestion): OptionReview[] {
  const e = studyExplanation(q), statements = listedStatements(q), count = statements.length;
  const isCode = count >= 2 && /statements?|correct answer using.*code/i.test(englishStudyText(q.question)) && !/chronological|chronology|sequence|order in which|match list/i.test(englishStudyText(q.question));
  const selected = isCode && q.answer ? selection(q.options[q.answer], count) : null;
  const counts = /how many/i.test(englishStudyText(q.question)) && count > 1 && q.answer ? countChoice(q.options[q.answer], count) : null;
  return Object.entries(q.options).map(([key, text]) => {
    if (e?.options?.[key]) return { key, text, reason: e.options[key], basis: q.explanationReview ? "reference" : "source" };
    const optionCount = counts !== null ? countChoice(text, count) : null;
    if (optionCount !== null && counts !== null && e?.justification) return { key, text,
      reason: `This choice counts ${optionCount} of the ${count} listed entries. The supplied answer counts ${counts}; ${optionCount === counts ? "the counts agree" : optionCount < counts ? `this is ${counts - optionCount} too few` : `this is ${optionCount - counts} too many`}. ${englishStudyText(e.justification)}`, basis: "code" };
    const code = isCode ? selection(text, count) : null;
    if (selected && code) {
      const extra = code.filter(n => !selected.includes(n)), missing = selected.filter(n => !code.includes(n));
      const details = [`This code selects ${code.length ? `statement${code.length === 1 ? "" : "s"} ${code.join(", ")}` : "no statements"}.`];
      if (!extra.length && !missing.length) details.push("It matches the supplied answer's selection.");
      if (extra.length) details.push(`It includes ${extra.join(", ")}, which the supplied answer excludes.`);
      if (missing.length) details.push(`It omits ${missing.join(", ")}, which the supplied answer includes.`);
      const covered = statements.filter(s => code.includes(s.number)).map(s => sentenceEvidence(e?.justification || "", s.text)).filter(Boolean);
      if (covered.length) details.push([...new Set(covered)].join(" "));
      return { key, text, reason: details.join(" "), basis: "code" };
    }
    const evidence = sentenceEvidence(e?.justification || "", text);
    if (evidence) return { key, text, reason: evidence, basis: "source" };
    if (key === q.answer && e?.justification) return { key, text, reason: cleanStudyText(e.justification), basis: "source" };
    return { key, text, reason: "The supplied explanation does not give a separate reason for this choice. Its facts still need an independent reference check.", basis: "missing" };
  });
}
export const completeOptionExplanation = (q: PYQQuestion) => {
  const notes = studyExplanation(q)?.options;
  return !!notes && Object.keys(q.options).every(k => notes[k]?.trim());
};
