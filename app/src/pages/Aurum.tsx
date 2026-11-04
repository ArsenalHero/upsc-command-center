import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, CheckCircle2, Flag, Layers3, Play, RefreshCw, Search, ShieldCheck, Shuffle } from "lucide-react";
import type { GoldenAPI } from "../components/mock/GoldenCatalogue";
import { Modal, ProgressBar } from "../components/ui";
import { QuestionText } from "../components/QuestionText";
import { ReviewedExplanationText } from "../components/ReviewedExplanation";
import type { PYQQuestion } from "../utils/pyq";
import { aurumSources, aurumSubjects, type AurumCatalog, type AurumFlagReceipt, type AurumOpenRequest, type AurumReviewFilter, type AurumSession, type AurumSource } from "../utils/aurum";
import { OutcomeGraphic } from "../components/aurum/OutcomeGraphic";
import "../aurum.css";

const AurumInsights = lazy(() => import("../components/aurum/AurumInsights"));
const root = "/tests/prelims/aurum";

export default function Aurum({ api }: { api: GoldenAPI }) {
  const location = useLocation(), navigate = useNavigate();
  const section = location.pathname.endsWith("/analysis") ? "analysis" : location.pathname.endsWith("/review") ? "review" : "practice";
  const [catalog, setCatalog] = useState<AurumCatalog | null>(null), [catalogKey, setCatalogKey] = useState("");
  const [source, setSource] = useState<AurumSource>("both"), [subjects, setSubjects] = useState<string[]>([]);
  const [count, setCount] = useState("10"), [search, setSearch] = useState("");
  const [session, setSession] = useState<AurumSession | null>(null), [error, setError] = useState("");
  const [selection, setSelection] = useState<AurumOpenRequest | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const requestId = useRef<string | null>(null), cache = useRef(new Map<string, AurumCatalog>());
  const routeKey = `${location.pathname}${location.search}`, currentRoute = useRef(routeKey); currentRoute.current = routeKey;
  const queryKey = JSON.stringify([source, [...subjects].sort()]);

  useEffect(() => { setSession(null); setSelection(null); setError(""); }, [location.pathname]);
  useEffect(() => {
    if (section !== "practice" || session) return;
    let live = true;
    setError("");
    const cached = cache.current.get(queryKey);
    if (cached) { setCatalog(cached); setCatalogKey(queryKey); setLoading(false); return; }
    setLoading(true);
    // Coalesce quick checkbox changes; never download question bodies at setup.
    const timer = setTimeout(() => {
      const [selectedSource, selectedSubjects] = JSON.parse(queryKey);
      api<AurumCatalog>("aurum-catalog", { source: selectedSource, subjects: selectedSubjects })
        .then(next => { if (live) { cache.current.set(queryKey, next); setCatalog(next); setCatalogKey(queryKey); } })
        .catch(e => { if (live) setError(e.message); })
        .finally(() => { if (live) setLoading(false); });
    }, catalog ? 100 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [api, queryKey, reload, section, session?.id]);

  const names = [...aurumSubjects];
  const counts = new Map(catalog?.subjects.map(s => [s.name, s[source]]) || []);
  const matching = names.filter(s => s.toLowerCase().includes(search.toLowerCase()));
  const ready = !!catalog && catalogKey === queryKey && !loading;
  const available = ready ? catalog.available : 0, n = Number(count);
  const valid = ready && subjects.length > 0 && Number.isInteger(n) && n >= 1 && n <= 100 && n <= available;
  const selectedSource = aurumSources.find(s => s.id === source)!;

  function refresh() { cache.current.clear(); setReload(v => v + 1); }
  async function start() {
    if (!valid || busy) return;
    setBusy(true); setError("");
    const openingRoute = routeKey;
    try {
      requestId.current ||= crypto.randomUUID();
      const next = await api<AurumSession>("aurum-start-v2", { requestId: requestId.current, source, subjects, count: n });
      requestId.current = null; cache.current.clear();
      if (currentRoute.current === openingRoute) { setSelection(null); setSession(next); }
    } catch (e) { if (currentRoute.current === openingRoute) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function openSession(request: AurumOpenRequest) {
    if (busy) return;
    setBusy(true); setError("");
    const openingRoute = routeKey;
    try { const saved = await api<AurumSession>("aurum-session", { sessionId: request.sessionId }); if (currentRoute.current === openingRoute) { setSelection(request); setSession(saved); } }
    catch (e) { if (currentRoute.current === openingRoute) setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function back() { setSession(null); setSelection(null); refresh(); }
  function go(view: "practice" | "analysis" | "review", filter?: AurumReviewFilter) {
    back(); navigate(`${root}${view === "practice" ? "" : `/${view}`}${filter ? `?filter=${filter}` : ""}`);
  }

  if (session) return <AurumPractice key={session.id} initial={session} api={api} initialQuestionId={selection?.questionId} initialFilter={selection?.filter} onBack={back} onNewSet={() => go("practice")} onAnalysis={() => go("analysis")} onReview={filter => go("review", filter)} />;
  return <div className="aurum">
    <section className="aurum-hero">
      <div><span className="eyebrow">GOLDEN GATE / SUBJECT PRACTICE</span><h2>Aurum<span>A focused set. A fresh start.</span></h2>
        <p>Your subjects, your pace. Practise with PYQs, mock questions, or both.</p>
        <div className="aurum-hero-details"><span><ShieldCheck size={14} />No repeats</span><span><CheckCircle2 size={14} />Progress saved</span><span>Untimed practice</span></div>
      </div>
      <div className="aurum-emblem" role="img" aria-label="Au: gold, atomic number 79">
        <div className="aurum-element-face" aria-hidden="true">
          <div className="aurum-element-top"><span className="aurum-element-number">79</span><span className="aurum-element-mass">196.96657</span></div>
          <span className="aurum-element-symbol">Au</span>
          <span className="aurum-element-name">GOLD</span>
          <span className="aurum-element-configuration">[Xe] 4f<sup>14</sup> 5d<sup>10</sup> 6s<sup>1</sup></span>
        </div>
      </div>
    </section>
    <nav className="aurum-tabs" aria-label="Aurum sections"><Link to={root} aria-current={section === "practice" ? "page" : undefined}><Play size={15} />Practice</Link><Link to={`${root}/analysis`} aria-current={section === "analysis" ? "page" : undefined}><BarChart3 size={15} />Analysis &amp; history</Link><Link to={`${root}/review`} aria-current={section === "review" ? "page" : undefined}><Flag size={15} />Review questions</Link></nav>
    {section !== "practice" ? <>{error && <p className="mock-error" role="alert">{error}</p>}<Suspense fallback={<p className="card aurum-report-loading" role="status">Opening your saved practice…</p>}><AurumInsights api={api} view={section} opening={busy} onOpen={openSession} /></Suspense></> : <>
    {catalog?.active && <section className="card aurum-resume"><div><Play size={20} /><div><h3>Pick up where you left off</h3>
      <p>{catalog.active.summary.answered} of {catalog.active.summary.total} reviewed · {catalog.active.subjects.join(" · ")}</p></div></div>
      <button className="btn primary" disabled={busy} onClick={() => void openSession({ sessionId: catalog.active!.id })}>Resume practice<ArrowRight size={15} /></button></section>}
    <div className="aurum-builder">
      <section className="card aurum-config" aria-label="Build an Aurum practice set">
        <fieldset className="aurum-fieldset"><legend><span>01</span>Question source</legend>
          <div className="aurum-source-grid">{aurumSources.map(s => <label key={s.id} className={source === s.id ? "selected" : ""}>
            <input type="radio" name="aurum-source" value={s.id} checked={source === s.id} onChange={() => setSource(s.id)} />
            <span className="aurum-source-icon" aria-hidden="true">{s.id === "pyq" ? <BookOpen size={18} /> : s.id === "mock" ? <Layers3 size={18} /> : <Shuffle size={18} />}</span>
            <span className="aurum-source-text"><strong>{s.label}</strong><small>{s.description}</small></span>
          </label>)}</div>
        </fieldset>
        <fieldset className="aurum-fieldset"><legend><span>02</span>Your subjects <small>{subjects.length ? `${subjects.length} selected` : "Choose one or more"}</small></legend>
          <div className="aurum-subject-tools"><div className="aurum-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label="Find an Aurum subject" placeholder="Search subjects" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div><button type="button" className="text-btn" disabled={!catalog} onClick={() => setSubjects(names.filter(s => (counts.get(s) || 0) > 0))}>Select all available</button>
            <button type="button" className="text-btn" disabled={!subjects.length} onClick={() => setSubjects([])}>Clear</button></div></div>
          <div className="aurum-subject-grid" aria-busy={!catalog && loading}>{!catalog && loading ? Array.from({ length: 18 }, (_, i) => <div className="aurum-subject-skeleton" key={i} aria-hidden="true" />)
            : matching.map(s => <label key={s} className={`${subjects.includes(s) ? "selected" : ""} ${!counts.get(s) ? "exhausted" : ""}`}>
              <input type="checkbox" checked={subjects.includes(s)} onChange={e => setSubjects(previous => e.target.checked ? [...previous, s] : previous.filter(v => v !== s))} />
              <span>{s}</span><small aria-label={`${counts.get(s) || 0} fresh questions`}>{(counts.get(s) || 0).toLocaleString()}</small>
            </label>)}</div>
          {!catalog && loading && <p className="aurum-pool-status" role="status">Loading subjects…</p>}
          {catalog && !matching.length && <p className="muted">No subjects match your search.</p>}
          {catalog && <p className="aurum-subject-help">AMAC: Ancient &amp; Medieval History, Art &amp; Culture. Counts show fresh questions.</p>}
        </fieldset>
        <fieldset className="aurum-fieldset"><legend><span>03</span>Set size</legend>
          <div className="aurum-count-controls"><label htmlFor="aurum-count"><span>Number of questions</span><input id="aurum-count" type="number" inputMode="numeric" min={1} max={Math.min(100, available) || 100} step={1} value={count} onChange={e => setCount(e.target.value)} aria-describedby="aurum-count-help" /></label>
            <div className="aurum-quick-count" role="group" aria-label="Quick question counts">{[5, 10, 20, 50].map(value => <button key={value} aria-pressed={n === value} disabled={!ready || value > available || !subjects.length} onClick={() => setCount(String(value))}>{value}</button>)}</div></div>
          <p id="aurum-count-help" className="small muted">Up to 100 questions. You can save and leave at any time.</p>
        </fieldset>
      </section>
      <aside className="card aurum-set-summary" aria-label="Your practice set">
        <div className="aurum-summary-heading"><span className="aurum-summary-icon"><Layers3 size={19} /></span><div><span className="eyebrow">READY WHEN YOU ARE</span><h3>Your practice set</h3></div></div>
        <div className="aurum-available" aria-live="polite" aria-busy={!ready}><strong>{ready ? available.toLocaleString() : "…"}</strong><span>{subjects.length ? "fresh questions in your selection" : "fresh questions to explore"}</span></div>
        <dl><div><dt>Source</dt><dd>{selectedSource.label}</dd></div><div><dt>Subjects</dt><dd>{subjects.length ? `${subjects.length} selected` : "None selected"}</dd></div><div><dt>Set size</dt><dd>{Number.isInteger(n) && n > 0 ? `${n} questions` : "—"}</dd></div></dl>
        {!!subjects.length && ready && !available && <p className="aurum-notice" role="status">You’ve used every question in this selection. Add subjects or change the source to keep practising.</p>}
        {!!subjects.length && ready && available > 0 && n > available && <p className="aurum-notice" role="status">Only {available} fresh questions remain. Choose a smaller set or add subjects.</p>}
        {!!subjects.length && (!Number.isInteger(n) || n < 1 || n > 100) && <p className="aurum-notice" role="status">Enter a whole number from 1 to 100.</p>}
        {error && <div className="aurum-error"><p className="mock-error" role="alert">{error}</p><button className="text-btn" onClick={refresh}><RefreshCw size={14} />Try again</button></div>}
        <button className="btn primary" disabled={!valid || busy || !!catalog?.active} onClick={() => void start()}>{busy ? "Opening practice…" : catalog?.active ? "Resume your current set above" : "Start practice"}<ArrowRight size={16} /></button>
        <p className="aurum-start-help">{!subjects.length ? "Select your subjects to begin." : !ready ? "Checking fresh questions…" : "A fresh set, made for your selection."}</p>
        <div className="aurum-save-note"><ShieldCheck size={17} /><p>Previously used questions stay out of future sets. Your progress saves automatically.</p></div>
        {source === "both" && ready && subjects.length > 0 && <div className="aurum-source-counts"><span>{catalog.sources.pyq.toLocaleString()} PYQs</span><span>{catalog.sources.mock.toLocaleString()} mock questions</span><small>Shared questions count once.</small></div>}
      </aside>
    </div>
    {catalog && <section className="aurum-history"><p><CheckCircle2 size={15} />{catalog.practised.toLocaleString()} questions reserved · {catalog.completed} sets completed</p>
      {catalog.latest && <button className="text-btn" disabled={busy} onClick={() => void openSession({ sessionId: catalog.latest!.id })}>Review latest set<ArrowRight size={14} /></button>}</section>}
    </>}
  </div>;
}

function AurumPractice({ initial, api, initialQuestionId, initialFilter = "all", onBack, onNewSet, onAnalysis, onReview }: {
  initial: AurumSession; api: GoldenAPI; initialQuestionId?: string; initialFilter?: AurumReviewFilter;
  onBack: () => void; onNewSet: () => void; onAnalysis: () => void; onReview: (filter: AurumReviewFilter) => void;
}) {
  const [session, setSession] = useState(initial), [index, setIndex] = useState(() => {
    const focused = initial.questions.findIndex(q => q.id === initialQuestionId);
    return focused >= 0 ? focused : Math.max(0, initial.questions.findIndex(q => !initial.answers[q.id]));
  });
  const [choice, setChoice] = useState({ questionId: "", option: "" }), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false), [filter, setFilter] = useState<AurumReviewFilter>(initialFilter);
  const heading = useRef<HTMLHeadingElement>(null);
  const completed = session.status === "completed", flags = session.flags || [], summary = session.summary;
  const visible = session.questions.map((q, i) => ({ q, i })).filter(({ q }) => !completed || filter === "all" || (filter === "flagged" ? flags.includes(q.id) : session.answers[q.id]?.outcome === filter)).map(({ i }) => i);
  const active = visible.includes(index) ? index : visible[0] ?? 0, position = visible.indexOf(active);
  const q = visible.length ? session.questions[active] : undefined, answer = q ? session.answers[q.id] : undefined;
  const option = choice.questionId === q?.id ? choice.option : "";
  useEffect(() => { heading.current?.focus(); }, [active, q?.id]);
  async function save(skip = false) {
    if (!q || busy || (!skip && !option)) return;
    setBusy(true); setError("");
    try { setSession(await api<AurumSession>("aurum-answer", { sessionId: session.id, questionId: q.id, option: skip ? "" : option })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true); setError("");
    try { setSession(await api<AurumSession>("aurum-finish", { sessionId: session.id })); setConfirm(false); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function toggleFlag() {
    if (!q || busy) return;
    setBusy(true); setError("");
    try {
      const saved = await api<AurumFlagReceipt>("aurum-flag", { sessionId: session.id, questionId: q.id, flagged: !flags.includes(q.id) });
      setSession(previous => ({ ...previous, flags: saved.flags }));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const filters: [AurumReviewFilter, string, number][] = [["all", "All questions", summary.total], ["incorrect", "Wrong", summary.incorrect], ["flagged", "Flagged", flags.length], ["correct", "Correct", summary.correct], ["skipped", "Skipped", summary.skipped]];
  return <div className="aurum aurum-practice">
    <div className="aurum-practice-top"><button className="text-btn" onClick={onBack} disabled={busy}><ArrowLeft size={16} />{session.status === "running" ? "Save & leave" : "Back to Aurum"}</button><span><ShieldCheck size={14} />{busy ? "Saving…" : "Progress saved"}</span></div>
    <section className="card aurum-practice-heading"><div><span className="eyebrow">AURUM · {session.status === "completed" ? "SET COMPLETE" : "YOUR PRACTICE SET"}</span><h2>{session.subjects.join(" · ")}</h2><p>{summary.answered} of {summary.total} reviewed · Untimed practice</p></div>
      <div className="aurum-score"><strong>{summary.correct}</strong><span>correct</span><strong>{summary.incorrect}</strong><span>incorrect</span><strong>{summary.skipped}</strong><span>skipped</span></div>
      <ProgressBar value={100 * summary.answered / summary.total} /></section>
    {completed && <>
      <section className="card aurum-complete" role="status"><CheckCircle2 size={28} /><div><h3>Practice complete</h3><p>{summary.correct} correct out of {summary.correct + summary.incorrect} attempted. Your results and flags stay saved for later.</p></div><button className="btn primary" onClick={onNewSet}>Build another set<ArrowRight size={16} /></button></section>
      <div className="aurum-completion-analysis"><OutcomeGraphic summary={summary} title="This set · right vs wrong" /><section className="card aurum-review-shortcuts"><span className="eyebrow">YOUR NEXT STEP</span><h3>Turn practice into progress</h3><p>Review a mistake, save a question with a flag, or see how you are doing across all your sets.</p><button className="btn primary" onClick={onAnalysis}><BarChart3 size={16} />Overall analysis &amp; history</button><button className="text-btn" onClick={() => onReview("incorrect")}>All wrong questions<ArrowRight size={14} /></button><button className="text-btn" onClick={() => onReview("flagged")}><Flag size={14} />Your flagged questions</button></section></div>
      <div className="aurum-review-filter-bar" role="group" aria-label="Filter this set">{filters.map(([key, label, total]) => <button key={key} disabled={busy} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}<span>{total}</span></button>)}</div>
    </>}
    {error && <p className="mock-error" role="alert">{error}</p>}
    <div className="aurum-question-layout">
      {q ? <section className="card aurum-question" aria-label="Practice question">
        <div className="aurum-question-toolbar"><div className="aurum-question-meta"><span className="aurum-origin">{q.origin === "pyq" ? "PYQ" : "MOCK"}</span><span>{q.subject} · {q.topic}</span></div><button className="aurum-flag-btn" disabled={busy} aria-pressed={flags.includes(q.id)} onClick={() => void toggleFlag()}><Flag size={15} />{flags.includes(q.id) ? "Flagged" : "Flag question"}</button></div>
        <h3 ref={heading} tabIndex={-1}>Question {active + 1} of {session.questions.length}</h3>
        <QuestionText q={{ question: q.question, blocks: q.blocks, number: active + 1, sourceImage: q.sourceImage, sourceImageAlt: q.sourceImageAlt || `${q.sourceLabel} diagram` } as PYQQuestion} />
        <fieldset className="aurum-options" disabled={busy || !!answer}><legend className="sr-only">Choose an answer</legend>{Object.entries(q.options).map(([key, text]) =>
          <label key={key} className={`${(answer?.option || option) === key ? "selected" : ""} ${answer && q.correct === key ? "correct" : ""} ${answer?.outcome === "incorrect" && answer.option === key ? "incorrect" : ""}`}>
            <input type="radio" name={`aurum-answer-${q.id}`} value={key} checked={(answer?.option || option) === key} onChange={() => setChoice({ questionId: q.id, option: key })} /><strong>{key.toUpperCase()}</strong><span>{text}</span>
            {answer && q.correct === key && <CheckCircle2 size={18} aria-label="Correct answer" />}
          </label>)}</fieldset>
        {answer && <section className={`aurum-feedback ${answer.outcome}`} aria-live="polite"><h4>{answer.outcome === "correct" ? "Correct" : answer.outcome === "skipped" ? "Skipped" : "Keep learning"} · Answer {q.correct?.toUpperCase()}</h4>
          {q.explanation ? typeof q.explanation === "string" ? <p>{q.explanation}</p> : <ReviewedExplanationText explanation={q.explanation} /> : <p>An explanation hasn’t been supplied for this question.</p>}
        </section>}
        <p className="small muted">{q.sourceLabel}</p>
        <div className="button-group aurum-question-actions"><button className="btn secondary" disabled={position <= 0 || busy} onClick={() => setIndex(visible[position - 1])}>Previous</button>
          {!answer ? <><button className="btn secondary" disabled={busy} onClick={() => void save(true)}>Skip question</button><button className="btn primary" disabled={!option || busy} onClick={() => void save()}>{busy ? "Saving…" : "Check answer"}</button></>
            : position < visible.length - 1 ? <button className="btn primary" disabled={busy} onClick={() => setIndex(visible[position + 1])}>Next question<ArrowRight size={16} /></button>
              : <button className="btn primary" disabled={busy} onClick={() => { const next = session.questions.findIndex(question => !session.answers[question.id]); if (completed) onNewSet(); else if (next >= 0) setIndex(next); else onBack(); }}>{completed ? "Build another set" : "Next unanswered question"}<ArrowRight size={16} /></button>}
        </div>
      </section> : <section className="card aurum-report-empty"><h3>No {filter === "incorrect" ? "wrong" : filter} questions in this set</h3><p>{filter === "flagged" ? "Open any question and use its flag to save it for later." : "Choose another filter to keep reviewing."}</p><button className="btn secondary" onClick={() => setFilter("all")}>Show all questions</button></section>}
      <aside className="card aurum-palette"><h3>{completed ? `${visible.length} questions to review` : "Your questions"}</h3><div role="group" aria-label="Practice question navigation">{visible.map(i => { const question = session.questions[i]; return <button key={question.id} disabled={busy} className={`${session.answers[question.id]?.outcome || ""} ${active === i ? "current" : ""}`} aria-label={`Question ${i + 1}${session.answers[question.id] ? `, ${session.answers[question.id].outcome}` : ", unanswered"}${flags.includes(question.id) ? ", flagged" : ""}`} aria-current={active === i ? "step" : undefined} onClick={() => setIndex(i)}>{i + 1}{flags.includes(question.id) && <Flag size={9} aria-hidden="true" />}</button>; })}</div>
        <p className="small muted">{completed ? "Results stay saved. Flag questions to find them in Review questions anytime." : "Checked answers are final. Skip a question to reveal its answer."}</p>
        {session.status === "running" && <button className="btn secondary" disabled={busy} onClick={() => setConfirm(true)}>Finish this set</button>}
      </aside>
    </div>
    {confirm && <Modal title="Finish this practice set?" onClose={() => { if (!busy) setConfirm(false); }}><div className="modal-body"><p>{summary.total - summary.answered} unanswered questions will be marked skipped. All questions in this set stay excluded from future Aurum sets.</p>{error && <p className="mock-error" role="alert">{error}</p>}</div><div className="modal-foot"><button className="btn secondary" disabled={busy} onClick={() => setConfirm(false)}>Keep practising</button><button className="btn primary" disabled={busy} onClick={() => void finish()}>{busy ? "Saving…" : "Finish set"}</button></div></Modal>}
  </div>;
}
