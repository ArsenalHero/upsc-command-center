import { writeFileSync } from "node:fs";
import { questionBank, historyEconomyBank } from "../src/data/questionBank.ts";
import { completeOptionExplanation, explanationStatus, optionReviews } from "../src/utils/explanationReview.ts";

// Run with: node --import tsx scripts/audit-explanations.mjs
const summary = { checkedOn: "2026-10-04", sourceQuestions: historyEconomyBank.length, uniqueQuestions: questionBank.length,
  statuses: {}, completeOptionExplanations: 0, optionsNeedingSeparateExplanation: 0, questionsNeedingSeparateOptionExplanation: 0, reviewedQuestions: [] };
for (const q of questionBank) {
  const status = explanationStatus(q); summary.statuses[status] = (summary.statuses[status] || 0) + 1;
  if (completeOptionExplanation(q)) summary.completeOptionExplanations++;
  const missing = optionReviews(q).filter(note => note.basis === "missing");
  summary.optionsNeedingSeparateExplanation += missing.length;
  if (missing.length) summary.questionsNeedingSeparateOptionExplanation++;
  if (q.explanationReview) summary.reviewedQuestions.push({ id: q.id, status, answer: q.answer, issue: q.explanationReview.issue || "", references: q.explanationReview.explanation.references.map(ref => ref.url) });
}
writeFileSync(new URL("../docs/EXPLANATION-AUDIT.json", import.meta.url), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify({ ...summary, reviewedQuestions: summary.reviewedQuestions.length }));
