import type { StudyExplanation } from "../utils/pyq";
import { cleanStudyText } from "../utils/explanationReview";

export function ReviewedExplanationText({ explanation: e }: { explanation: StudyExplanation }) {
  return <div className="prelims-reviewed-explanation">
    <h4>Explanation</h4>
    <p className="prelims-provided-text">{cleanStudyText(e.justification)}</p>
    {e.concept && <p><strong>Concept: </strong>{e.concept}</p>}
    {e.statements?.map(s => <p key={s.label}><strong>{s.label} · {s.verdict}: </strong>{s.reason}</p>)}
    {e.elimination && <p><strong>Elimination: </strong>{e.elimination}</p>}
    {e.insight && <p><strong>Exam insight: </strong>{e.insight}</p>}
    {!!e.relatedConcepts?.length && <p><strong>Revise: </strong>{e.relatedConcepts.join(" · ")}</p>}
  </div>;
}
