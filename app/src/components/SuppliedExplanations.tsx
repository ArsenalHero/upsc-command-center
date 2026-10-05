import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { suppliedExplanations, type SuppliedExplanation } from "../data/suppliedExplanations";
import { reviewedLibraryQuestion } from "../data/reviewedLibrary";
import { ReviewedExplanationText } from "./ReviewedExplanation";
import { englishSourceHTML } from "../utils/englishQuestion";

// These static fragments are validated against a tag/attribute allowlist by the importer.
export function SuppliedHTML({ html, question = false }: { html: string; question?: boolean }) {
  return <div className={`prelims-supplied-html${question ? " source-question" : ""}`} dangerouslySetInnerHTML={{ __html: englishSourceHTML(html) }} />;
}
export function SuppliedExplanationText({ entry }: { entry: SuppliedExplanation }) {
  return <div className="prelims-supplied-explanation">
    <h4>Explanation</h4>
    <SuppliedHTML html={entry.explanation} />
  </div>;
}
export function SuppliedExplanationLibrary() {
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState("");
  const [exam, setExam] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [opened, setOpened] = useState<SuppliedExplanation>();
  const subjects = useMemo(() => [...new Set(suppliedExplanations.map(e => e.studySubject))].sort(), []);
  const years = useMemo(() => [...new Set(suppliedExplanations.map(e => e.year).filter(Boolean))].sort().reverse(), []);
  const exams = useMemo(() => [...new Set(suppliedExplanations.map(e => e.exam).filter(Boolean))].sort(), []);
  const filtered = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return suppliedExplanations.filter(e => (!subject || e.studySubject === subject) && (!year || e.year === year) && (!exam || e.exam === exam)
      && terms.every(term => [e.questionText, e.exam, e.topic, e.studySubject, e.year, ...e.options.map(([, html]) => html)].join(" ").toLowerCase().includes(term)));
  }, [subject, year, exam, query]);
  const current = Math.min(page, Math.max(0, Math.ceil(filtered.length / 10) - 1));
  const change = (set: (value: string) => void, value: string) => { set(value); setPage(0); };
  const reviewed = opened ? reviewedLibraryQuestion(opened.id) : undefined;
  if (opened) return <section className="card supplied-explanation-detail" aria-label="Explanation detail">
    <button className="btn secondary" onClick={() => setOpened(undefined)}><ChevronLeft size={16} />Back to explanations</button>
    <p className="eyebrow">{opened.exam || "Exam not supplied"} · {opened.year || "Year not supplied"} · {opened.studySubject} · Q{opened.n}</p>
    <h2>{opened.topic}</h2>
    <SuppliedHTML html={opened.question} question />
    <ul className="supplied-options">{opened.options.map(([key, html]) => <li key={key}><strong>{key}.</strong><SuppliedHTML html={html} /></li>)}</ul>
    <p className="prelims-answer-note"><strong>Answer: {reviewed ? reviewed.answer?.toUpperCase() || "Awaiting key" : opened.answer || "Awaiting key"}</strong></p>
    {reviewed?.explanationReview ? <>{reviewed.explanationReview.status === "disputed" && <p className="prelims-answer-note">Answer needs review</p>}<ReviewedExplanationText explanation={reviewed.explanationReview.explanation} /></> : <SuppliedExplanationText entry={opened} />}
  </section>;
  return <>
    <section className="card prelims-filters">
      <h2>Explanation library</h2>
      <p>Explore {suppliedExplanations.length.toLocaleString()} explanation entries by subject, year and exam. Entries can cover the same question more than once; the practice bank counts unique questions.</p>
      <div className="prelims-filter-grid">
        <label>Subject<select aria-label="Explanation subject" value={subject} onChange={e => change(setSubject, e.target.value)}><option value="">All subjects</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Year<select aria-label="Explanation year" value={year} onChange={e => change(setYear, e.target.value)}><option value="">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select></label>
        <label>Exam<select aria-label="Explanation exam" value={exam} onChange={e => change(setExam, e.target.value)}><option value="">All exams</option>{exams.map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Search questions<input type="search" aria-label="Search explanations" value={query} onChange={e => change(setQuery, e.target.value)} placeholder="Question, topic or exam…" /></label>
      </div>
      <button className="btn secondary" onClick={() => { setSubject(""); setYear(""); setExam(""); setQuery(""); setPage(0); }}>Clear explanation filters</button>
    </section>
    <div className="section-heading"><h2>{filtered.length.toLocaleString()} explanations</h2></div>
    {!filtered.length && <p className="card">No explanations match these filters.</p>}
    {filtered.slice(current * 10, (current + 1) * 10).map(entry => <article className="card prelims-bank-row" key={entry.id}>
      <div><span className="eyebrow">{entry.exam || "Exam not supplied"} · {entry.year || "Year not supplied"} · {entry.studySubject} · Q{entry.n}</span><h3>{entry.topic}</h3><p>{entry.questionText.slice(0, 200)}</p></div>
      <button className="btn secondary" aria-label={`Read explanation Q${entry.n}`} onClick={() => setOpened(entry)}>Read explanation</button>
    </article>)}
    <div className="prelims-actions supplied-explanation-pages"><button className="btn secondary" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={16} />Previous explanations</button><span>Page {current + 1} of {Math.max(1, Math.ceil(filtered.length / 10))}</span><button className="btn secondary" disabled={(current + 1) * 10 >= filtered.length} onClick={() => setPage(current + 1)}>Next explanations<ChevronRight size={16} /></button></div>
  </>;
}
