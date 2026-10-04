import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Bookmark, BookOpen, ChevronLeft, ChevronRight, Clock3, Download, Flag, Pause, Play, RotateCcw, Target, CheckCircle2, BarChart3 } from "lucide-react";
import { useData } from "../hooks/useData";
import { useAuth } from "../hooks/useAuth";
import { PageHeader, DashboardCard, ProgressBar } from "../components/ui";
import { exportCSV, exportJSON } from "../services/export";
import type { PrelimsFilters, PrelimsResponse, PrelimsSession, PrelimsWorkspace, PYQRecord } from "../types";
import { errorTypes } from "../types";
import { ActiveTimer, attemptStats, formatSeconds, latestAttempts, type PYQQuestion } from "../utils/pyq";
import { emptyFilters, emptyPrelims, emptyResponse, filterQuestions, keySnapshot, responseAttempt, sessionReport, shuffled, startSession } from "../utils/prelims";
import { originalBank, polityBank, geographyBank, questionBank as bank } from "../data/questionBank";
import { examGroups, examOccurrences, matchesExam, questionLabel } from "../utils/exams";
const byId = new Map(bank.map(q => [q.id, q]));
const unique = (values: string[]) => [...new Set(values)].sort();
const number = (n: number) => Number(n.toFixed(2)).toString();
const label = questionLabel;
const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
const result = (q: PYQQuestion, r?: PrelimsResponse) => !r?.option ? "Skipped" : r.option === (r.key?.answer || q.answer) ? "Right" : "Wrong";

function QuestionText({ q }: { q: PYQQuestion }) {
  return <div className="prelims-text">{(q.blocks || q.question.split(/\n\n/).map(text => ({ type: "paragraph", text }))).map((b, i) =>
    b.type === "table" ? <div className="prelims-table-wrap" key={i}><table><caption>Question {q.number} · matching pairs</caption><thead><tr>{b.headers?.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{b.rows?.map((row, j) => <tr key={j}>{row.map((cell, k) => k === 0 ? <th scope="row" key={k}>{cell}</th> : <td key={k}>{cell}</td>)}</tr>)}</tbody></table></div>
    : b.type === "list" ? <ul className="prelims-statements" key={i}>{b.items?.map((v, j) => <li key={j}>{v}</li>)}</ul>
    : b.type === "passage" ? <section className="prelims-passage" key={i} aria-label="Reading passage"><strong>Read the passage</strong><p>{b.text}</p><small>Answer the related items using this passage only.</small></section>
    : <p key={i}>{b.text}</p>)}</div>;
}
function Explanation({ q, answer = q.answer }: { q: PYQQuestion; answer?: string | null }) {
  const e = q.explanation, imported = !!q.sourceFile;
  return <section className="prelims-explanation" aria-label="Answer and explanation">
    <h3>{imported ? "Provided answer" : "Official answer"}: {answer?.toUpperCase() || "Awaiting key"}</h3>
    {e ? <>
      <h4>{imported ? "Explanation from supplied material" : "Study explanation"}</h4>
      <p className={imported ? "prelims-provided-text" : undefined}>{e.justification}</p>
      {e.concept && <p><strong>Concept: </strong>{e.concept}</p>}
      {e.statements?.map(s => <p key={s.label}><strong>{s.label} · {s.verdict}: </strong>{s.reason}</p>)}
      {e.options && <ul>{Object.entries(e.options).map(([k, v]) => <li key={k}><strong>{k.toUpperCase()}: </strong>{v}</li>)}</ul>}
      {e.elimination && <p><strong>Elimination: </strong>{e.elimination}</p>}
      {e.insight && <p><strong>Exam insight: </strong>{e.insight}</p>}
      {!!e.relatedConcepts?.length && <p><strong>Revise: </strong>{e.relatedConcepts.join(" · ")}</p>}
      {e.references.map((r, i) => <p className="small" key={i}><a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a>{r.section && ` · ${r.section}`}</p>)}
      <p className="small muted">{imported ? "Answer and explanation supplied in the uploaded study material; independent verification is pending." : "Study explanations are editorial notes. UPSC publishes the answer key."}</p>
    </> : <p>Detailed explanation: verification required. Use the original paper and official answer key linked below.</p>}
    {imported && <p className="small"><strong>Source: </strong>{q.sourceFile} · Q{q.sourceQuestionNumber}<br />{q.examOccurrences?.map(e => e.label).join(" · ") || "Exam and year not supplied"}</p>}
    {!!(q.sourceUrl || q.keyUrl) && <div className="prelims-actions">
      {q.sourceUrl && <a href={`${q.sourceUrl}#page=${q.page}`} target="_blank" rel="noreferrer">Original paper · page {q.page} ↗</a>}
      {q.keyUrl && <a href={q.keyUrl} target="_blank" rel="noreferrer">Official UPSC key (PDF mirror) ↗</a>}
    </div>}
  </section>;
}
function Breakdown({ title, rows }: { title: string; rows: ReturnType<typeof sessionReport>["groups"][string] }) {
  return <section className="card prelims-breakdown"><h3>{title}</h3><div className="table-wrap"><table><thead><tr><th>Category</th><th>Attempted</th><th>Right</th><th>Wrong</th><th>Accuracy</th><th>Active time</th></tr></thead><tbody>{Object.entries(rows).map(([name, g]) => <tr key={name}><th scope="row">{name}</th><td>{g.attempted}</td><td>{g.correct}</td><td>{g.incorrect}</td><td>{g.correct + g.incorrect ? `${number(100 * g.correct / (g.correct + g.incorrect))}%` : "—"}</td><td>{formatSeconds(g.seconds)}</td></tr>)}</tbody></table></div></section>;
}
function Report({ s, close, retry }: { s: PrelimsSession; close: () => void; retry: (qs: PYQQuestion[]) => void }) {
  const r = sessionReport(s, byId);
  const wrong = s.questionIds.map(id => byId.get(id)!).filter(q => q && result(q, s.responses[q.id]) === "Wrong");
  const correctAngle = 360 * r.correct / r.total, wrongAngle = 360 * (r.correct + r.incorrect) / r.total;
  const maximum = s.questionIds.reduce((n, id) => n + (s.responses[id]?.key?.marks || byId.get(id)?.marks || 0), 0);
  return <><PageHeader eyebrow="SAVED SESSION REPORT" title="Your paper report" description={`${s.mode === "test" ? "Test" : "Practice"} · ${new Date(s.startedAt).toLocaleString()} · ${r.total} questions`} /><div className="prelims-actions"><button className="btn secondary" onClick={close}>Back to question bank</button><button className="btn primary" disabled={!wrong.length} onClick={() => retry(wrong)}>Retry wrong questions</button></div><section className="card prelims-report-summary"><div className="prelims-outcome-ring" role="img" aria-label={`${r.correct} right, ${r.incorrect} wrong and ${r.unattempted} unattempted`} style={{ background: `conic-gradient(var(--green) 0deg ${correctAngle}deg, var(--red) ${correctAngle}deg ${wrongAngle}deg, var(--track) ${wrongAngle}deg 360deg)` } as CSSProperties}><div><strong>{r.attempted}<small>/{r.total}</small></strong><span>attempted</span></div></div><div className="prelims-report-headline"><span className="eyebrow">YOUR SESSION, AT A GLANCE</span><h2>{number(r.score)}<span> / {number(maximum)} marks</span></h2><p>Keep the lessons from this session. Review the mistakes, then practise again.</p><div className="prelims-result-legend"><span><i className="right" />{r.correct} right</span><span><i className="wrong" />{r.incorrect} wrong</span><span><i />{r.unattempted} unattempted</span></div></div></section><div className="stats-grid four"><DashboardCard title="Final score" value={number(r.score)} detail={`Raw ${number(r.raw)} − penalty ${number(r.penalty)}`} /><DashboardCard title="Right / wrong" value={`${r.correct} / ${r.incorrect}`} detail={`${r.attempted} attempted · ${r.unattempted} unattempted`} /><DashboardCard title="Accuracy" value={r.accuracy === null ? "—" : `${number(r.accuracy)}%`} detail="Right ÷ graded attempts" /><DashboardCard title="Active time" value={formatSeconds(r.seconds)} detail={`${formatSeconds(r.total ? r.seconds / r.total : 0)} average per question`} /></div><p className="small muted">Uploaded Polity and Geography questions use +1 for right and 0 for wrong or skipped. The original 2025 papers retain their official one-third penalty. State PSC practice scores do not claim an official exam marking scheme.</p>{s.questionIds.length === 80 && s.questionIds.every(id => byId.get(id)?.stage === "CSAT") && <p className="card">CSAT benchmark: {r.score >= 66 ? "At or above" : "Below"} 66/200 (33%). This is a practice score.</p>}<Breakdown title="Subject performance" rows={r.groups.subject} /><Breakdown title="Topic performance" rows={r.groups.topic} /><Breakdown title="Difficulty performance" rows={r.groups.difficultyLabel} /><section className="card"><h2>Review every question</h2>{s.questionIds.map(id => { const q = byId.get(id), a = s.responses[id]; if (!q) return null; return <details className="prelims-review-row" key={id}><summary>{label(q)} · {result(q, a)} · {formatSeconds(a?.seconds || 0)}{a?.review ? " · Review" : ""}</summary><QuestionText q={q} /><ul className="prelims-review-options">{Object.entries(q.options).map(([k, v]) => <li key={k}>{k.toUpperCase()}. {v}{k === a?.option ? " · Your answer" : ""}</li>)}</ul><Explanation q={q} answer={a?.key?.answer || q.answer} />{a?.notes && <p><strong>Your notes: </strong>{a.notes}</p>}</details>; })}</section></>;
}

export default function PYQs() {
  const { data, savePrelims, setEditor } = useData(); const { guest } = useAuth();
  const w = data.prelims || emptyPrelims(), f = w.filters;
  const [tab, setTab] = useState("Browse"), [page, setPage] = useState(0), [active, setActive] = useState(false), [report, setReport] = useState<PrelimsSession>(), [timed, setTimed] = useState(true), [startHint, setStartHint] = useState("");
  const latest = useMemo(() => latestAttempts(data.pyqs), [data.pyqs]);
  const filtered = filterQuestions(bank, f, latest, w.bookmarks, w.review);
  const collection = bank.filter(q => matchesExam(q, f) && (!f.subject || q.subject === f.subject));
  const collectionIds = new Set(collection.map(q => q.id));
  const records = data.pyqs.filter(p => p.attempt && collectionIds.has(p.attempt.questionId)), stats = attemptStats(records);
  const change = (k: keyof PrelimsFilters, value: string) => {
    const next = { ...f, [k]: value };
    if (k === "subject") { next.paper = ""; next.topic = ""; next.subtopic = ""; next.query = ""; }
    if (k === "topic") next.subtopic = "";
    if (k === "state") next.exam = "";
    if (savePrelims({ ...w, filters: next })) setPage(0);
  };
  const selectExam = (value: string) => {
    const next = { ...emptyFilters(), subject: f.subject, examGroup: value };
    if (savePrelims({ ...w, filters: next })) { setPage(0); setTab("Browse"); }
  };
  const start = (qs: PYQQuestion[], mode: "practice" | "test" = "practice", clock = false) => {
    if (!qs.length) return;
    if (w.session && !w.session.endedAt) { setStartHint("Resume and finish your current session before starting another. Your answers are saved."); return; }
    setStartHint("");
    try {
      const s = startSession(qs, mode, f, clock); s.responses[qs[0].id].review = w.review.includes(qs[0].id);
      if (savePrelims({ ...w, session: s })) { setReport(undefined); setActive(true); }
    } catch (e) { setStartHint((e as Error).message); }
  };
  const sequence = (q: PYQQuestion) => {
    const qs = filterQuestions(bank, { ...f, paper: q.paper, query: "", status: "" }, latest, w.bookmarks, w.review);
    return qs.slice(qs.findIndex(next => next.id === q.id));
  };
  const facetBank = bank.filter(q => (!f.examGroup || matchesExam(q, { ...emptyFilters(), examGroup: f.examGroup })) && (!f.subject || q.subject === f.subject));
  const facetExams = facetBank.flatMap(q => examOccurrences(q)).filter(e => !f.examGroup || e.group === f.examGroup);
  const years = [...new Set(facetExams.filter(e => !f.state || e.state === f.state).map(e => e.year))].sort((a, b) => b - a);
  const states = unique(facetExams.map(e => e.state).filter(Boolean));
  const exams = unique(facetExams.filter(e => !f.state || e.state === f.state).map(e => e.name));
  const groupCount = (group: string) => bank.filter(q => (!f.subject || q.subject === f.subject) && matchesExam(q, { ...emptyFilters(), examGroup: group })).length;
  if (report) return <div className="pyq-workspace"><Report s={report} close={() => setReport(undefined)} retry={qs => start(qs)} /></div>;
  if (active && w.session) return <div className="pyq-workspace"><Session close={() => setActive(false)} report={s => { setActive(false); setReport(s); }} /></div>;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 10) - 1));
  const pools = {
    "Latest mistakes": collection.filter(q => latest.get(q.id)?.attempt?.outcome === "incorrect"),
    "Skipped": collection.filter(q => latest.get(q.id)?.attempt?.outcome === "skipped"),
    "Bookmarked": collection.filter(q => w.bookmarks.includes(q.id)),
    "Marked for review": collection.filter(q => w.review.includes(q.id) || latest.get(q.id)?.revisionNeeded),
    "Repeat mistakes": collection.filter(q => records.filter(a => a.attempt?.questionId === q.id && a.attempt.outcome === "incorrect").length > 1),
  };
  return <div className="pyq-workspace">
    <PageHeader eyebrow="UPSC · STATE PSC · POLITY & GEOGRAPHY" title="PYQ question bank" description="Choose your subject, exam and year. Practise in English and Hindi, review explanations, and track every attempt." action={<button className="btn secondary" onClick={() => setEditor({ collection: "pyqs" })}>Log outside practice</button>} />
    <div className="pyq-coverage card"><BookOpen size={26} /><div><strong>{bank.length.toLocaleString()} questions ready to practise</strong><p>{polityBank.length.toLocaleString()} uploaded Polity questions · {geographyBank.length.toLocaleString()} uploaded Geography questions<br />Separate UPSC CSE, State PSC and CDS/CAPF collections · complete 2025 papers: 100 GS I + 80 CSAT</p></div></div>
    <p className="pyq-save-note">{guest ? "Guest progress is saved in this browser. Export a backup to keep a separate copy." : "Progress is saved in your personal workspace. Account shows your cloud sync status."}</p>
    {w.session && !w.session.endedAt && <section className="card pyq-resume"><div><strong>Continue your {w.session.mode}</strong><p>Question {w.session.index + 1} of {w.session.questionIds.length}{w.session.deadline ? " · 2-hour deadline continues while away" : " · active timer excludes time away"}</p></div><button className="btn primary" onClick={() => setActive(true)}>Resume {w.session.mode}</button></section>}
    {startHint && <p role="status" className="card">{startHint}</p>}
    <div className="stats-grid four"><DashboardCard title="Questions practised" icon={<Target size={18} />} value={stats.unique} detail={`${stats.total} saved attempts in this collection`} /><DashboardCard title="Right / wrong" icon={<CheckCircle2 size={18} />} tone="green" value={`${stats.correct} / ${stats.incorrect}`} detail={`${stats.skipped} skipped`} /><DashboardCard title="Accuracy" icon={<BarChart3 size={18} />} tone="purple" value={stats.accuracy === null ? "—" : `${number(stats.accuracy)}%`} /><DashboardCard title="Active study time" icon={<Clock3 size={18} />} tone="amber" value={formatSeconds(stats.seconds)} /></div>
    <div className="prelims-exam-collections" role="group" aria-label="Exam collections">
      <button className={`btn ${!f.examGroup ? "primary" : "secondary"}`} aria-pressed={!f.examGroup} onClick={() => selectExam("")}>All exams</button>
      {examGroups.map(group => <button key={group} className={`btn ${f.examGroup === group ? "primary" : "secondary"}`} aria-label={group} aria-pressed={f.examGroup === group} onClick={() => selectExam(group)}>{group}<span>{groupCount(group)}</span></button>)}
    </div>
    <div className="tabs" role="tablist" aria-label="PYQ sections">{["Browse", "Full papers", "Revision", "Performance", "History"].map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
    {tab === "Browse" && <>
      <section className="card prelims-filters">
        <div className="prelims-subjects" role="group" aria-label="PYQ subject collections"><button className={`btn ${!f.subject ? "primary" : "secondary"}`} aria-pressed={!f.subject} onClick={() => change("subject", "")}>All subjects</button>{unique(bank.map(q => q.subject)).map(s => <button className={`btn ${f.subject === s ? "primary" : "secondary"}`} aria-pressed={f.subject === s} key={s} onClick={() => change("subject", s)}>{s}</button>)}</div>
        <div className="prelims-filter-grid">
          <label>Year<select aria-label="PYQ year" value={f.year || ""} onChange={e => change("year", e.target.value)}><option value="">All years</option>{years.map(y => <option key={y} value={y || "unknown"}>{y || "Not supplied"}</option>)}</select></label>
          <label>State<select aria-label="PYQ state" value={f.state || ""} onChange={e => change("state", e.target.value)}><option value="">All states</option>{states.map(state => <option key={state}>{state}</option>)}</select></label>
          <label>Exam<select aria-label="PYQ exam" value={f.exam || ""} onChange={e => change("exam", e.target.value)}><option value="">All exams in collection</option>{exams.map(exam => <option key={exam}>{exam}</option>)}</select></label>
          <label>Stage<select aria-label="PYQ exam stage" value={f.examStage || ""} onChange={e => change("examStage", e.target.value)}><option value="">All stages</option>{["Prelims", "Mains", "CSAT", "Not supplied"].map(stage => <option key={stage}>{stage}</option>)}</select></label>
          <label>Paper<select aria-label="PYQ paper" value={f.paper} onChange={e => change("paper", e.target.value)}><option value="">All papers</option>{unique(facetBank.map(q => q.paper)).map(p => <option key={p}>{p}</option>)}</select></label>
          <label>Subject<select aria-label="PYQ subject" value={f.subject} onChange={e => change("subject", e.target.value)}><option value="">All subjects</option>{unique(bank.map(q => q.subject)).map(p => <option key={p}>{p}</option>)}</select></label>
          <label>Topic<select aria-label="PYQ topic" value={f.topic} onChange={e => change("topic", e.target.value)}><option value="">All topics</option>{unique(facetBank.map(q => q.topic)).map(p => <option key={p}>{p}</option>)}</select></label>
          <label>Subtopic<select aria-label="PYQ subtopic" value={f.subtopic || ""} onChange={e => change("subtopic", e.target.value)}><option value="">All subtopics</option>{unique(facetBank.filter(q => !f.topic || q.topic === f.topic).map(q => q.subtopic || "")).filter(Boolean).map(p => <option key={p}>{p}</option>)}</select></label>
          <label>Difficulty<select aria-label="PYQ difficulty" value={f.difficulty} onChange={e => change("difficulty", e.target.value)}><option value="">All difficulty levels</option>{["Easy", "Moderate", "Difficult"].map(p => <option key={p}>{p}</option>)}</select></label>
          <label>Status<select aria-label="PYQ status" value={f.status} onChange={e => change("status", e.target.value)}><option value="">All questions</option>{Object.entries({ attempted: "Attempted", unattempted: "Unattempted", correct: "Right", incorrect: "Wrong", skipped: "Skipped", bookmarked: "Bookmarked", review: "Marked for review" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="prelims-search">Search question, exam or topic<input type="search" aria-label="Search PYQs" value={f.query} onChange={e => change("query", e.target.value)} placeholder="Try: Monsoon, BPSC, GEO6, Constitution…" /></label>
        </div>
        <p className="small muted">Exam labels and years come from the source material. Topic tags are study classifications. One unlabelled question remains available without a guessed exam or year.</p>
      </section>
      <div className="section-heading"><h2>{filtered.length} questions</h2><div className="prelims-actions"><button className="btn primary" disabled={!filtered.length} onClick={() => start(filtered)}>Practise filtered questions</button><button className="btn secondary" disabled={!filtered.length} onClick={() => start(shuffled(filtered))}>Shuffle practice</button><button className="btn secondary" disabled={!filtered.length} onClick={() => start(filtered, "test")}>Test filtered questions</button></div></div>
      {!filtered.length && <div className="card">No questions match these filters.</div>}
      {filtered.slice(currentPage * 10, (currentPage + 1) * 10).map(q => <article className="card prelims-bank-row" key={q.id}><div><span className="eyebrow">{label(q)} · {q.subject}</span><h3>{q.topic}</h3><p>{q.blocks?.find(b => b.type === "paragraph")?.text || q.question.slice(0, 160)}</p><span className="muted small">{q.sourceFile ? q.examOccurrences?.map(e => e.label).join(" · ") || "Exam and year not supplied" : q.difficultyLabel} · {latest.get(q.id)?.attempt?.outcome || "Unattempted"}</span></div><div className="prelims-actions"><button className="btn primary" aria-label={`Practise ${label(q)}`} onClick={() => start(sequence(q))}>Practise</button><button className="btn secondary" aria-label={`Bookmark ${label(q)}`} aria-pressed={w.bookmarks.includes(q.id)} onClick={() => savePrelims({ ...w, bookmarks: toggle(w.bookmarks, q.id) })}><Bookmark size={16} />{w.bookmarks.includes(q.id) ? "Bookmarked" : "Bookmark"}</button></div></article>)}
      <div className="prelims-actions"><button className="btn secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous page</button><span>Page {currentPage + 1} of {Math.max(1, Math.ceil(filtered.length / 10))}</span><button className="btn secondary" disabled={(currentPage + 1) * 10 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next page</button></div>
    </>}
    {tab === "Full papers" && <>
      <p className="small muted">Complete original papers are available for UPSC CSE 2025. Uploaded Polity and Geography collections contain the questions supplied in your study material.</p>
      <label className="prelims-check"><input type="checkbox" checked={timed} onChange={e => setTimed(e.target.checked)} />Use a 2-hour test deadline</label>
      <div className="prelims-paper-grid">{["Prelims", "CSAT"].map(stage => { const qs = originalBank.filter(q => q.stage === stage); return <section className="card" key={stage}><span className="eyebrow">2025 · BOOKLET A</span><h2>{stage === "CSAT" ? "CSAT Paper II" : "General Studies Paper I"}</h2><p>{qs.length} questions · 200 marks · 2 hours</p><p>Right +{qs[0].marks} · wrong −{number(qs[0].marks / 3)} · skip 0</p><div className="prelims-actions"><button className="btn secondary" onClick={() => start(qs)}>Practise {stage === "CSAT" ? "CSAT" : "GS"} paper</button><button className="btn primary" onClick={() => start(qs, "test", timed)}>Start {stage === "CSAT" ? "CSAT" : "GS"} test</button></div></section>; })}</div>
    </>}
    {tab === "Revision" && <div className="prelims-paper-grid">{Object.entries(pools).map(([name, qs]) => <section className="card" key={name}><h2>{name}</h2><p>{qs.length} questions</p><button className="btn primary" disabled={!qs.length} onClick={() => start(qs)}>Practise {name.toLowerCase()}</button></section>)}</div>}
    {tab === "Performance" && <Performance records={records} questions={collection} retry={qs => start(qs)} />}
    {tab === "History" && <><div className="prelims-actions"><button className="btn secondary" onClick={() => exportCSV(data, "pyqs")}><Download size={16} />Export attempts CSV</button><button className="btn secondary" onClick={() => exportJSON(data)}>Export full backup</button></div><section className="card"><h2>Saved paper reports</h2>{!w.reports?.length && <p>Complete a practice session or test to save its report.</p>}{[...(w.reports || [])].reverse().map(s => <div className="prelims-bank-row" key={s.id}><span>{s.mode} · {new Date(s.startedAt).toLocaleString()} · {s.questionIds.length} questions</span><button className="btn secondary" onClick={() => setReport(s)}>Open report</button></div>)}</section><section className="card"><h2>All saved attempts and study logs</h2><p className="small muted">All exam collections, earlier years and written Mains records remain in history and backups.</p>{!data.pyqs.length && <p>No attempts yet.</p>}{[...data.pyqs].reverse().map(p => <details className="prelims-review-row" key={p.id}><summary>{p.year || "Year not supplied"} · {p.attempt?.examName || p.paper} · {p.attempt ? `Q${p.attempt.questionNumber} · ${p.attempt.outcome} · ${formatSeconds(p.attempt.seconds)}` : p.date}</summary><p>{p.question}</p>{p.attempt && <><p>Selected {p.attempt.selectedOption.toUpperCase() || "—"} · Answer {p.attempt.answerOption.toUpperCase() || "—"} · Confidence {p.attempt.confidence}/5 · {p.attempt.errorType}</p>{p.attempt.sourceFile && <p>{p.attempt.sourceFile} · {p.attempt.examLabels}</p>}</>}<p>{p.conceptGap}</p></details>)}</section></>}
  </div>;
}
function Performance({ records, questions, retry }: { records: PYQRecord[]; questions: PYQQuestion[]; retry: (qs: PYQQuestion[]) => void }) {
  const latest = latestAttempts(records); const groups: Record<string, { attempted: number; correct: number; incorrect: number; seconds: number }> = {};
  for (const r of latest.values()) { const q = byId.get(r.attempt!.questionId)!; const g = groups[q.topic] ||= { attempted: 0, correct: 0, incorrect: 0, seconds: 0 }; g.attempted += +!!r.attempt!.selectedOption; g.correct += r.correct; g.incorrect += r.incorrect; g.seconds += r.attempt!.seconds; }
  const weak = Object.entries(groups).filter(([, g]) => g.correct + g.incorrect && g.correct / (g.correct + g.incorrect) < .6).map(([name]) => name);
  return <><p className="muted">Latest attempt per question · weak topics have accuracy below 60%. Small samples can change quickly.</p><Breakdown title="Topic performance" rows={groups} /><section className="card"><h2>Weak topics</h2>{!weak.length && <p>No weak topics identified yet.</p>}{weak.map(t => <div className="prelims-bank-row" key={t}><span>{t}</span><button className="btn secondary" onClick={() => retry(questions.filter(q => q.topic === t))}>Revise topic</button></div>)}</section></>;
}

function Session({ close, report }: { close: () => void; report: (s: PrelimsSession) => void }) {
  const { data, savePrelims } = useData();
  const workspace = data.prelims!; const s = workspace.session!; const q = byId.get(s.questionIds[s.index]);
  const wRef = useRef(workspace); const saveRef = useRef(savePrelims); wRef.current = workspace; saveRef.current = savePrelims;
  const timer = useRef(new ActiveTimer(s.responses[s.questionIds[s.index]]?.seconds || 0));
  const [paused, setPaused] = useState(false), [displayTime, setDisplayTime] = useState(0), [remaining, setRemaining] = useState(0), [hint, setHint] = useState("");
  const pauseRef = useRef(false), finishing = useRef(false); const finishRef = useRef<() => void>(() => {});
  const locked = s.mode === "practice" && !!s.responses[s.questionIds[s.index]]?.submitted;
  const persist = (next: PrelimsWorkspace, attempts: PYQRecord[] = []) => { const ok = saveRef.current(next, attempts); if (ok) wRef.current = next; return ok; };
  const snapshot = () => { const w = structuredClone(wRef.current), ss = w.session!, id = ss.questionIds[ss.index]; const r = ss.responses[id] ||= emptyResponse(); if (!(ss.mode === "practice" && r.submitted) && !ss.endedAt) r.seconds = timer.current.seconds(performance.now()); return w; };
  const deadlinePassed = () => { const ss = wRef.current.session!; if (ss.deadline && Date.now() >= Date.parse(ss.deadline) && !ss.endedAt) { finishRef.current(); return true; } return false; };
  const checkpoint = () => { const w = snapshot(); return JSON.stringify(w) === JSON.stringify(wRef.current) || persist(w); };
  const edit = (fields: Partial<PrelimsResponse>) => { if (deadlinePassed()) return; const w = snapshot(), ss = w.session!, id = ss.questionIds[ss.index], r = ss.responses[id]; if (ss.endedAt || (ss.mode === "practice" && r.submitted && fields.option !== undefined)) return; Object.assign(r, fields); const question = byId.get(id)!; persist(w, r.submitted ? [responseAttempt(question, ss, r, data.subjects)] : []); };
  const submit = (skip = false) => {
    if (deadlinePassed()) return false;
    const w = snapshot(), ss = w.session!, id = ss.questionIds[ss.index], r = ss.responses[id], question = byId.get(id)!;
    if (ss.endedAt || r.submitted) return true;
    if (ss.mode === "test") { if (skip) r.option = ""; return persist(w); }
    if (!skip && !r.option) { setHint("Choose an option, or use Skip question."); return false; }
    timer.current.pause(performance.now()); r.submitted = true; r.key = keySnapshot(question); if (skip) r.option = "";
    r.review ||= !!r.option && r.option !== r.key.answer; const attempt = responseAttempt(question, ss, r, data.subjects);
    if (r.review && !w.review.includes(id)) w.review.push(id);
    if (!persist(w, [attempt])) { if (!pauseRef.current && !document.hidden) timer.current.start(performance.now()); return false; }
    setHint(skip ? "Skipped. Time and notes saved." : "Answer saved."); return true;
  };
  const go = (index: number) => {
    if (deadlinePassed()) return;
    const w = snapshot(), ss = w.session!; if (ss.endedAt || index < 0 || index >= ss.questionIds.length) return;
    ss.index = index; const id = ss.questionIds[index]; ss.responses[id] ||= { ...emptyResponse(), review: w.review.includes(id) }; ss.responses[id].visited = true;
    if (persist(w)) { pauseRef.current = false; setPaused(false); setHint(""); }
  };
  const next = () => { const ss = wRef.current.session!, r = ss.responses[ss.questionIds[ss.index]]; if (ss.mode === "practice" && !r.submitted && !submit(!r.option)) return; if (ss.index < ss.questionIds.length - 1) go(ss.index + 1); else finishRef.current(); };
  const finish = () => {
    if (finishing.current) return; finishing.current = true;
    const w = snapshot(), ss = w.session!; if (ss.endedAt) { report(ss); return; }
    timer.current.pause(performance.now()); const attempts: PYQRecord[] = [];
    for (const id of ss.questionIds) { const question = byId.get(id); if (!question) continue; const r = ss.responses[id] ||= { ...emptyResponse(), visited: false, review: w.review.includes(id) }; r.key ||= keySnapshot(question); if (r.visited && (ss.mode === "test" || !r.submitted)) { r.submitted = true; r.review ||= !!r.option && r.option !== r.key.answer; const a = responseAttempt(question, ss, r, data.subjects); if (r.review && !w.review.includes(id)) w.review.push(id); attempts.push(a); } }
    ss.endedAt = new Date().toISOString(); w.reports = [...(w.reports || []).filter(r => r.id !== ss.id), structuredClone(ss)].slice(-1000);
    if (persist(w, attempts)) report(ss); else { finishing.current = false; if (!pauseRef.current && !document.hidden) timer.current.start(performance.now()); }
  };
  finishRef.current = finish;
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [s.index]);
  useEffect(() => {
    const current = wRef.current.session!, id = current.questionIds[current.index]; timer.current = new ActiveTimer(current.responses[id]?.seconds || 0);
    if (!pauseRef.current && !document.hidden && !(current.mode === "practice" && current.responses[id]?.submitted)) timer.current.start(performance.now());
    setDisplayTime(timer.current.seconds(performance.now()));
    const visibility = () => { if (document.hidden) { timer.current.pause(performance.now()); checkpoint(); } else if (!pauseRef.current && !locked) timer.current.start(performance.now()); };
    const unload = () => { timer.current.pause(performance.now()); checkpoint(); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("pagehide", unload);
    let ticks = 0; const interval = window.setInterval(() => { setDisplayTime(timer.current.seconds(performance.now())); const current = wRef.current.session!; if (current.deadline) { setRemaining(Math.max(0, (Date.parse(current.deadline) - Date.now()) / 1000)); if (Date.now() >= Date.parse(current.deadline) && !current.endedAt) finishRef.current(); } if (++ticks % 20 === 0 && !current.endedAt) checkpoint(); }, 500);
    if (current.deadline && Date.now() >= Date.parse(current.deadline)) finishRef.current();
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("pagehide", unload); timer.current.pause(performance.now()); };
  }, [s.id, s.index, locked]);
  useEffect(() => () => { timer.current.pause(performance.now()); const current = wRef.current.session; if (current && !current.endedAt) checkpoint(); }, []);
  if (!q) return <div className="card"><p>This session contains a question outside the current bank. Its history remains saved.</p><button className="btn secondary" onClick={close}>Back to question bank</button></div>;
  const r = s.responses[q.id] || emptyResponse();
  return <><PageHeader eyebrow={`${s.mode.toUpperCase()} · ${q.sourceFile ? `PART ${q.sourcePart} · SUPPLIED MATERIAL` : "BOOKLET A · ORIGINAL ORDER"}`} title={`${q.year || "Year not supplied"} · ${q.paper}`} description={`Question ${s.index + 1} of ${s.questionIds.length} · ${q.sourceFile ? "Source" : "Original"} Q${q.number} · ${q.subject} · ${q.topic}`} /><div className="prelims-session-top"><div className="prelims-actions"><Clock3 size={18} /><strong aria-label="Question active time">{formatSeconds(displayTime)}</strong><span>active on this question</span>{!locked && <button className="btn secondary" onClick={() => { if (!paused) timer.current.pause(performance.now()); else if (!document.hidden) timer.current.start(performance.now()); pauseRef.current = !paused; setPaused(!paused); checkpoint(); }}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Resume timer" : "Pause timer"}</button>}</div>{s.deadline && <strong aria-label="Test time remaining">{formatSeconds(remaining || Math.max(0, (Date.parse(s.deadline) - Date.now()) / 1000))} remaining · deadline continues while paused</strong>}<button className="btn secondary" onClick={() => { timer.current.pause(performance.now()); if (checkpoint()) close(); else if (!pauseRef.current && !document.hidden) timer.current.start(performance.now()); }}>Save & exit</button></div><div className="prelims-session-layout"><article className="card prelims-question-card"><div className="prelims-actions"><span className="eyebrow">{label(q)}{q.difficultyLabel ? ` · ${q.difficultyLabel}` : ""}</span><button className="btn secondary" aria-pressed={workspace.bookmarks.includes(q.id)} onClick={() => { const w = snapshot(); w.bookmarks = toggle(w.bookmarks, q.id); persist(w); }}><Bookmark size={15} />{workspace.bookmarks.includes(q.id) ? "Bookmarked" : "Bookmark question"}</button><button className="btn secondary" aria-pressed={r.review} onClick={() => { if (deadlinePassed()) return; const w = snapshot(), ss = w.session!, rr = ss.responses[q.id]; rr.review = !rr.review; w.review = rr.review ? unique([...w.review, q.id]) : w.review.filter(id => id !== q.id); persist(w, rr.submitted ? [responseAttempt(q, ss, rr, data.subjects)] : []); }}><Flag size={15} />{r.review ? "Marked for review" : "Mark for review"}</button></div><QuestionText q={q} /><fieldset className="prelims-options"><legend>Choose one answer</legend>{Object.entries(q.options).map(([k, v]) => <label className={r.option === k ? "selected" : ""} key={k}><input type="radio" name="pyq-option" value={k} checked={r.option === k} disabled={locked} onChange={() => edit({ option: k })} /><strong>{k.toUpperCase()}.</strong><span>{v}</span></label>)}</fieldset>{s.mode === "test" && <p className="small muted">Answers and explanations appear after you finish the test.</p>}{s.mode === "practice" && <label className="prelims-auto-next"><input type="checkbox" aria-label="Automatically open next question after submit" checked={!!workspace.autoAdvance} onChange={e => { const w = snapshot(); w.autoAdvance = e.target.checked; persist(w); }} />Automatically open the next question after submit</label>}<div className="prelims-actions">{s.mode === "practice" && !r.submitted && <button className="btn primary" onClick={() => { if (submit() && wRef.current.autoAdvance) next(); }}>Submit answer</button>}{!locked && <button className="btn secondary" onClick={() => edit({ option: "" })}>Clear answer</button>}{!locked && <button className="btn secondary" onClick={() => { if (submit(true) && s.index < s.questionIds.length - 1) go(s.index + 1); }}>Skip question</button>}</div>{hint && <p role="status">{hint}</p>}{locked && <><div className={`prelims-feedback ${result(q, r).toLowerCase()}`}><div><strong>{result(q, r) === "Right" ? "Correct answer" : result(q, r) === "Wrong" ? "Answer saved · let’s review" : "Question skipped"}</strong><span>{result(q, r)} · {formatSeconds(r.seconds)} active time saved</span></div><button className="btn primary" onClick={next}>{s.index < s.questionIds.length - 1 ? "Next question" : "View report"}<ChevronRight size={17} /></button></div><Explanation q={q} answer={r.key?.answer} /></>}<details className="prelims-notes"><summary>Confidence, mistake category & notes</summary><div className="prelims-filter-grid"><label>Confidence<select aria-label="Question confidence" value={r.confidence} onChange={e => edit({ confidence: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}/5</option>)}</select></label><label>Mistake category<select aria-label="Question mistake category" value={r.errorType} onChange={e => edit({ errorType: e.target.value })}><option value="">Choose category</option>{errorTypes.map(t => <option key={t}>{t}</option>)}</select></label></div><label>Personal notes<textarea aria-label="Question notes" value={r.notes} onChange={e => edit({ notes: e.target.value })} placeholder="What will you revise?" /></label><p className="small muted">Changes save automatically. Submitted answers and times stay fixed.</p></details><div className="prelims-actions prelims-navigation"><button className="btn secondary" disabled={s.index === 0} onClick={() => go(s.index - 1)}><ChevronLeft size={16} />Previous question</button><button className="btn primary" onClick={next}>{s.index < s.questionIds.length - 1 ? "Next question" : "View report"}<ChevronRight size={16} /></button><button className="btn secondary" onClick={finish}>Finish {s.mode}</button></div></article><aside className="card prelims-palette"><span className="eyebrow">YOUR SESSION</span><h3>Question palette</h3><ProgressBar value={100 * Object.values(s.responses).filter(a => a.option || a.submitted).length / s.questionIds.length} label="Session progress" detail={`${Object.values(s.responses).filter(a => a.option || a.submitted).length}/${s.questionIds.length}`} /><p className="small muted">Filled: answered · outline: visited · flag: review · grey: unseen</p><div>{s.questionIds.map((id, i) => { const a = s.responses[id]; return <button key={id} aria-label={`Go to question ${i + 1}`} aria-current={i === s.index ? "step" : undefined} className={`${a?.option ? "answered" : a?.visited ? "visited" : "unseen"} ${a?.review ? "review" : ""} ${i === s.index ? "current" : ""}`} onClick={() => go(i)}>{i + 1}{a?.review ? " ⚑" : ""}</button>; })}</div></aside></div></>;
}
