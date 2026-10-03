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
export function questionLabel(q: PYQQuestion) {
  if (!q.sourceFile) return `${q.year} ${q.stage === "CSAT" ? "CSAT" : "GS I"} Q${q.number}`;
  const e = examOccurrences(q)[0];
  return `${e.name} ${e.year || "Year not supplied"} · Part ${q.sourcePart} Q${q.number}`;
}
