import type { PYQQuestion } from "../utils/pyq";
import { cleanStudyText } from "../utils/explanationReview";

export function QuestionText({ q }: { q: PYQQuestion }) {
  return <div className="prelims-text">{(q.blocks || cleanStudyText(q.question).split(/\n\n/).map(text => ({ type: "paragraph", text }))).map((b, i) =>
    b.type === "table" ? <div className="prelims-table-wrap" key={i}><table><caption>Question {q.number} · table</caption><thead><tr>{b.headers?.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{b.rows?.map((row, j) => <tr key={j}>{row.map((cell, k) => k === 0 ? <th scope="row" key={k}>{cell}</th> : <td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>
    : b.type === "list" ? <ul className="prelims-statements" key={i}>{b.items?.map((v, j) => <li key={j}>{v}</li>)}</ul>
    : b.type === "passage" ? <section className="prelims-passage" key={i} aria-label="Reading passage"><strong>Read the passage</strong><p>{b.text}</p><small>Answer the related items using this passage only.</small></section>
    : <p key={i}>{b.text}</p>)}</div>;
}
