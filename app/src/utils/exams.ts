import type { PrelimsFilters } from "../types";
import type { PYQQuestion } from "./pyq";

export const examGroups = ["UPSC CSE", "State PSC", "CDS & CAPF", "Unlabelled"] as const;
export function examOccurrences(q: PYQQuestion) {
  return q.examOccurrences?.length ? q.examOccurrences : [{
    group: q.sourceFile ? "Unlabelled" : "UPSC CSE", name: q.sourceFile ? "Not supplied" : "UPSC CSE",
    state: "", year: q.year, stage: q.sourceFile ? "Not supplied" : q.stage, label: "",
  }];
}
export function matchesExam(q: PYQQuestion, f: PrelimsFilters) {
  return examOccurrences(q).some(e => (!f.examGroup || e.group === f.examGroup)
    && (!f.state || e.state === f.state) && (!f.exam || e.name === f.exam)
    && (!f.examStage || e.stage === f.examStage)
    && (!f.year || String(e.year || "unknown") === f.year));
}
export function selectedExam(q: PYQQuestion, f: Partial<PrelimsFilters> = {}) {
  return examOccurrences(q).find(e => (!f.examGroup || e.group === f.examGroup) && (!f.state || e.state === f.state) && (!f.exam || e.name === f.exam) && (!f.examStage || e.stage === f.examStage) && (!f.year || String(e.year || "unknown") === f.year)) || examOccurrences(q)[0];
}
export function questionLabel(q: PYQQuestion, f: Partial<PrelimsFilters> = {}) {
  const e = selectedExam(q, f), primary = examOccurrences(q)[0];
  const display = e === primary ? q : q.sourceVariants?.find(copy => examOccurrences(copy).some(occurrence => occurrence.group === e.group && occurrence.name === e.name && occurrence.year === e.year && occurrence.stage === e.stage)) || q;
  if (!display.sourceFile) return `${display.year} ${display.stage === "CSAT" ? "CSAT" : "GS I"} Q${display.number}`;
  return `${e.name} ${e.year || "Year not supplied"} · ${display.sourceTitle ? `${display.sourceTitle} Q${display.number}` : `${display.subject === "Geography" ? "Geography · " : ""}Part ${display.sourcePart} Q${display.number}`}`;
}
