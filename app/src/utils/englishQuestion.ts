import type { PYQQuestion, StudyExplanation } from "./pyq";
import { englishStudyText } from "./explanationReview";
const english = (text: string) => /[\u0900-\u097f]/.test(text) ? englishStudyText(text) : text;

function englishExplanation(e?: StudyExplanation): StudyExplanation | undefined {
  if (!e) return e;
  return { ...e, justification: english(e.justification), concept: english(e.concept),
    ...(e.options ? { options: Object.fromEntries(Object.entries(e.options).map(([key, text]) => [key, english(text)])) } : {}),
    ...(e.statements ? { statements: e.statements.map(s => ({ label: english(s.label), verdict: english(s.verdict), reason: english(s.reason) })) } : {}),
    ...(e.insight ? { insight: english(e.insight) } : {}), ...(e.elimination ? { elimination: english(e.elimination) } : {}),
    ...(e.relatedConcepts ? { relatedConcepts: e.relatedConcepts.map(english) } : {}),
  };
}
export function englishQuestion(q: PYQQuestion, matches: Record<string, string[]> = {}): PYQQuestion {
  return { ...q, question: english(q.question), options: Object.fromEntries(Object.entries(q.options).map(([key, value]) => [key, english(value)])),
    ...(q.explanation ? { explanation: englishExplanation(q.explanation) } : {}),
    ...(q.explanationReview ? { explanationReview: { ...q.explanationReview, ...(q.explanationReview.issue ? { issue: english(q.explanationReview.issue) } : {}), explanation: englishExplanation(q.explanationReview.explanation)! } } : {}),
    ...(q.sourceNotes ? { sourceNotes: english(q.sourceNotes) } : {}),
    ...(q.blocks ? { blocks: q.blocks.map(b => ({ ...b, ...(b.text ? { text: english(b.text) } : {}), ...(b.items ? { items: b.items.map(english).filter(Boolean) } : {}), ...(b.headers ? { headers: b.headers.map(english) } : {}), ...(b.rows ? { rows: b.rows.map(row => row.map(english)).filter(row => row.some(Boolean)) } : {}) })) } : {}),
    ...(q.sourceVariants ? { sourceVariants: q.sourceVariants.map(copy => englishQuestion(copy, matches)) } : {}),
    ...(matches[q.id]?.length ? { suppliedExplanationIds: matches[q.id] } : {}),
  };
}
export function englishSourceHTML(html: string) {
  // Preserve the supplied English HTML; remove the two inline Hindi passages.
  if (!/[\u0900-\u097f]/.test(html)) return html;
  return html.replace(/[\u0900-\u097f]+(?:\s+[\u0900-\u097f]+)*/g, "").replace(/\(\s*\)/g, "");
}
