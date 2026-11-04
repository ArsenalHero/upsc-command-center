import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Layers3, Play, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import type { GoldenAPI } from "../components/mock/GoldenCatalogue";
import { Modal, ProgressBar } from "../components/ui";
import { QuestionText } from "../components/QuestionText";
import { ReviewedExplanationText } from "../components/ReviewedExplanation";
import type { PYQQuestion } from "../utils/pyq";
import { aurumCount, aurumPool, aurumSources, chooseAurumQuestions, type AurumCandidate, type AurumSession, type AurumSource, type AurumState } from "../utils/aurum";
import "../aurum.css";

export default function Aurum({ api }: { api: GoldenAPI }) {
  const [state, setState] = useState<AurumState | null>(null), [bank, setBank] = useState<AurumCandidate[]>([]);
  const [source, setSource] = useState<AurumSource>("both"), [subjects, setSubjects] = useState<string[]>([]);
  const [count, setCount] = useState("10"), [search, setSearch] = useState("");
  const [session, setSession] = useState<AurumSession | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    Promise.all([api<AurumState>("aurum-state"), import("../data/aurumBank").then(m => m.loadAurumPYQs())])
      .then(([next, pyqs]) => { if (live) { setState(next); setBank(pyqs); } })
      .catch(e => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, reload]);

  const candidates = useMemo(() => [...bank, ...(state?.mocks || [])], [bank, state?.mocks]);
  const seen = useMemo(() => [...(state?.seen || []), ...(state?.seenIds || [])], [state?.seen, state?.seenIds]);
  const fresh = useMemo(() => aurumPool(candidates, seen, source), [candidates, seen, source]);
  const names = useMemo(() => [...new Set(candidates.flatMap(q => q.subjects))].sort(), [candidates]);
  const pool = useMemo(() => aurumPool(candidates, seen, source, subjects), [candidates, seen, source, subjects]);
  const available = aurumCount(pool), n = Number(count);
  const valid = subjects.length > 0 && Number.isInteger(n) && n >= 1 && n <= 100 && n <= available;
  const counts = useMemo(() => new Map(names.map(s => [s, aurumCount(fresh.filter(q => q.subjects.includes(s)))])), [names, fresh]);

  async function start() {
    if (!valid || busy) return;
    setBusy(true); setError("");
    try {
      requestId.current ||= crypto.randomUUID();
      const next = await api<AurumSession>("aurum-start", {
        requestId: requestId.current, source, subjects, count: n, questions: chooseAurumQuestions(pool, n, source),
      });
      requestId.current = null;
      setSession(next);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function back() { setSession(null); setReload(v => v + 1); }

  if (session) return <AurumPractice key={session.id} initial={session} api={api} onBack={back} />;
  return <div className="aurum">
    <section className="aurum-hero">
      <div><span className="eyebrow">GOLDEN GATE · SUBJECT PRACTICE</span><h2>Aurum<span>A little practice. A fresh perspective.</span></h2>
        <p>Choose your subjects. Set your pace. Build a practice set from PYQs, mock tests, or a mix of both.</p>
        <span className="aurum-promise"><ShieldCheck size={16} />Fresh questions in every new set</span>
      </div><div className="aurum-emblem" aria-hidden="true"><Sparkles size={39} /><span>Au</span><small>AURUM</small></div>
    </section>
    {loading ? <div className="card aurum-loading" role="status">Preparing your fresh question pool…</div>
      : !state ? <section className="card aurum-empty" role="alert"><h3>We couldn’t open Aurum</h3><p>{error}</p><button className="btn primary" onClick={() => setReload(v => v + 1)}>Retry</button></section>
      : <>
        {state.active && <section className="card aurum-resume"><div><Play size={22} /><div><h3>Your practice is waiting</h3>
          <p>{state.active.summary.answered} of {state.active.summary.total} questions reviewed · {state.active.subjects.join(" · ")}</p></div></div>
          <button className="btn primary" onClick={() => setSession(state.active)}>Resume practice<ArrowRight size={16} /></button></section>}
        <div className="aurum-builder">
          <section className="card aurum-config" aria-label="Build an Aurum practice set">
            <fieldset className="aurum-fieldset"><legend><span>01</span>Choose your question source</legend>
              <div className="aurum-source-grid">{aurumSources.map(s => <label key={s.id} className={source === s.id ? "selected" : ""}>
                <input type="radio" name="aurum-source" value={s.id} checked={source === s.id} onChange={() => setSource(s.id)} />
                <span><strong>{s.label}</strong><small>{s.description}</small></span>{source === s.id && <Check size={16} aria-hidden="true" />}
              </label>)}</div>
            </fieldset>
            <fieldset className="aurum-fieldset"><legend><span>02</span>Select one or more subjects</legend>
              <div className="aurum-subject-tools"><input type="search" aria-label="Find an Aurum subject" placeholder="Find a subject…" value={search} onChange={e => setSearch(e.target.value)} />
                <button type="button" className="text-btn" onClick={() => setSubjects(names.filter(s => (counts.get(s) || 0) > 0))}>Select all available</button>
                <button type="button" className="text-btn" disabled={!subjects.length} onClick={() => setSubjects([])}>Clear</button></div>
              <div className="aurum-subject-grid">{names.filter(s => s.toLowerCase().includes(search.toLowerCase())).map(s => <label key={s} className={`${subjects.includes(s) ? "selected" : ""} ${!counts.get(s) ? "exhausted" : ""}`}>
                <input type="checkbox" checked={subjects.includes(s)} onChange={e => setSubjects(previous => e.target.checked ? [...previous, s] : previous.filter(v => v !== s))} />
                <span>{s}<small>{counts.get(s) || 0} fresh</small></span>
              </label>)}</div>
              {!names.some(s => s.toLowerCase().includes(search.toLowerCase())) && <p className="muted">No subjects match your search.</p>}
            </fieldset>
            <fieldset className="aurum-fieldset"><legend><span>03</span>How many questions?</legend>
              <div className="aurum-count-controls"><label htmlFor="aurum-count">Number of questions<input id="aurum-count" type="number" inputMode="numeric" min={1} max={Math.min(100, available) || 100} step={1} value={count} onChange={e => setCount(e.target.value)} aria-describedby="aurum-count-help" /></label>
                <div className="aurum-quick-count" role="group" aria-label="Quick question counts">{[5, 10, 20, 50].map(value => <button key={value} aria-pressed={n === value} disabled={value > available || !subjects.length} onClick={() => setCount(String(value))}>{value}</button>)}</div></div>
              <p id="aurum-count-help" className="small muted">Choose 1–100 questions, up to the number available in your selection.</p>
            </fieldset>
          </section>
          <aside className="card aurum-set-summary" aria-label="Your practice set">
            <span className="aurum-summary-icon"><Layers3 size={24} /></span><h3>Your next practice</h3>
            <div className="aurum-available" aria-live="polite"><strong>{subjects.length ? available.toLocaleString() : "—"}</strong><span>fresh questions available</span></div>
            <dl><div><dt>Source</dt><dd>{aurumSources.find(s => s.id === source)?.label}</dd></div><div><dt>Subjects</dt><dd>{subjects.length || "Choose below"}</dd></div><div><dt>Set size</dt><dd>{Number.isInteger(n) && n > 0 ? n : "—"}</dd></div></dl>
            {!!subjects.length && !available && <p className="aurum-notice" role="status">You’ve used every question in this selection. Add subjects or change the source to keep practising.</p>}
            {!!subjects.length && available > 0 && n > available && <p className="aurum-notice" role="status">Only {available} fresh questions remain. Choose a smaller set or add subjects.</p>}
            {!!subjects.length && (!Number.isInteger(n) || n < 1 || n > 100) && <p className="aurum-notice" role="status">Enter a whole number from 1 to 100.</p>}
            {error && <p className="mock-error" role="alert">{error}</p>}
            {error && <button className="text-btn" onClick={() => { requestId.current = null; setReload(v => v + 1); }}><RefreshCw size={14} />Refresh available questions</button>}
            <button className="btn primary" disabled={!valid || busy || !!state.active} onClick={() => void start()}>{busy ? "Creating your set…" : state.active ? "Resume your current set above" : "Start practice"}<ArrowRight size={16} /></button>
            {!subjects.length && <p className="small muted">Select a subject to begin.</p>}
            <p className="aurum-save-note"><ShieldCheck size={16} />Questions from every Aurum set stay excluded from future sets, including skipped questions. Your progress saves automatically.</p>
            {source === "both" && subjects.length > 0 && <p className="small muted">{aurumCount(pool.filter(q => q.origin === "pyq"))} PYQs · {aurumCount(pool.filter(q => q.origin === "mock"))} mock questions. Duplicates count once; a mixed set uses both sources when available.</p>}
          </aside>
        </div>
        <section className="aurum-history"><p><CheckCircle2 size={16} />{state.practised} questions reserved across {state.completed} completed sets</p>
          {state.latest && <button className="text-btn" onClick={() => setSession(state.latest)}>Review latest set<ArrowRight size={14} /></button>}</section>
      </>}
  </div>;
}

function AurumPractice({ initial, api, onBack }: { initial: AurumSession; api: GoldenAPI; onBack: () => void }) {
  const [session, setSession] = useState(initial), [index, setIndex] = useState(() => Math.max(0, initial.questions.findIndex(q => !initial.answers[q.id])));
  const [option, setOption] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const q = session.questions[index], answer = session.answers[q.id], summary = session.summary;
  useEffect(() => { setOption(""); heading.current?.focus(); }, [index]);
  async function save(skip = false) {
    if (busy || (!skip && !option)) return;
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
  return <div className="aurum aurum-practice">
    <div className="aurum-practice-top"><button className="text-btn" onClick={onBack} disabled={busy}><ArrowLeft size={16} />{session.status === "running" ? "Save & leave" : "Back to Aurum"}</button><span><ShieldCheck size={14} />{busy ? "Saving…" : "Progress saved"}</span></div>
    <section className="card aurum-practice-heading"><div><span className="eyebrow">AURUM · {session.status === "completed" ? "SET COMPLETE" : "YOUR PRACTICE SET"}</span><h2>{session.subjects.join(" · ")}</h2><p>{summary.answered} of {summary.total} reviewed · Untimed practice</p></div>
      <div className="aurum-score"><strong>{summary.correct}</strong><span>correct</span><strong>{summary.incorrect}</strong><span>incorrect</span><strong>{summary.skipped}</strong><span>skipped</span></div>
      <ProgressBar value={100 * summary.answered / summary.total} /></section>
    {session.status === "completed" && <section className="card aurum-complete" role="status"><CheckCircle2 size={28} /><div><h3>Practice complete</h3><p>{summary.correct} correct out of {summary.correct + summary.incorrect} attempted. Review the questions below, or build a fresh set.</p></div><button className="btn primary" onClick={onBack}>Build another set<ArrowRight size={16} /></button></section>}
    <div className="aurum-question-layout">
      <section className="card aurum-question" aria-label="Practice question">
        <div className="aurum-question-meta"><span className="aurum-origin">{q.origin === "pyq" ? "PYQ" : "MOCK"}</span><span>{q.subject} · {q.topic}</span></div>
        <h3 ref={heading} tabIndex={-1}>Question {index + 1} of {session.questions.length}</h3>
        <QuestionText q={{ question: q.question, blocks: q.blocks, number: index + 1, sourceImage: q.sourceImage, sourceImageAlt: q.sourceImageAlt || `${q.sourceLabel} diagram` } as PYQQuestion} />
        <fieldset className="aurum-options" disabled={busy || !!answer}><legend className="sr-only">Choose an answer</legend>{Object.entries(q.options).map(([key, text]) =>
          <label key={key} className={`${(answer?.option || option) === key ? "selected" : ""} ${answer && q.correct === key ? "correct" : ""} ${answer?.outcome === "incorrect" && answer.option === key ? "incorrect" : ""}`}>
            <input type="radio" name={`aurum-answer-${q.id}`} value={key} checked={(answer?.option || option) === key} onChange={() => setOption(key)} /><strong>{key.toUpperCase()}</strong><span>{text}</span>
            {answer && q.correct === key && <CheckCircle2 size={18} aria-label="Correct answer" />}
          </label>)}</fieldset>
        {answer && <section className={`aurum-feedback ${answer.outcome}`} aria-live="polite"><h4>{answer.outcome === "correct" ? "Correct" : answer.outcome === "skipped" ? "Skipped" : "Keep learning"} · Answer {q.correct?.toUpperCase()}</h4>
          {q.explanation ? typeof q.explanation === "string" ? <p>{q.explanation}</p> : <ReviewedExplanationText explanation={q.explanation} /> : <p>An explanation hasn’t been supplied for this question.</p>}
        </section>}
        <p className="small muted">{q.sourceLabel}</p>
        {error && <p className="mock-error" role="alert">{error}</p>}
        <div className="button-group aurum-question-actions"><button className="btn secondary" disabled={index === 0 || busy} onClick={() => setIndex(v => v - 1)}>Previous</button>
          {!answer ? <><button className="btn secondary" disabled={busy} onClick={() => void save(true)}>Skip question</button><button className="btn primary" disabled={!option || busy} onClick={() => void save()}>{busy ? "Saving…" : "Check answer"}</button></>
            : index < session.questions.length - 1 ? <button className="btn primary" disabled={busy} onClick={() => setIndex(v => v + 1)}>Next question<ArrowRight size={16} /></button>
              : <button className="btn primary" disabled={busy} onClick={() => { const next = session.questions.findIndex(question => !session.answers[question.id]); if (next >= 0) setIndex(next); else onBack(); }}>{session.status === "completed" ? "Build another set" : "Next unanswered question"}<ArrowRight size={16} /></button>}
        </div>
      </section>
      <aside className="card aurum-palette"><h3>Your questions</h3><div role="group" aria-label="Practice question navigation">{session.questions.map((question, i) => <button key={question.id} disabled={busy} className={`${session.answers[question.id]?.outcome || ""} ${index === i ? "current" : ""}`} aria-label={`Question ${i + 1}${session.answers[question.id] ? `, ${session.answers[question.id].outcome}` : ", unanswered"}`} aria-current={index === i ? "step" : undefined} onClick={() => setIndex(i)}>{i + 1}</button>)}</div>
        <p className="small muted">Checked answers are final. Skip a question to reveal its answer.</p>
        {session.status === "running" && <button className="btn secondary" disabled={busy} onClick={() => setConfirm(true)}>Finish this set</button>}
      </aside>
    </div>
    {confirm && <Modal title="Finish this practice set?" onClose={() => { if (!busy) setConfirm(false); }}><div className="modal-body"><p>{summary.total - summary.answered} unanswered questions will be marked skipped. All questions in this set stay excluded from future Aurum sets.</p>{error && <p className="mock-error" role="alert">{error}</p>}</div><div className="modal-foot"><button className="btn secondary" disabled={busy} onClick={() => setConfirm(false)}>Keep practising</button><button className="btn primary" disabled={busy} onClick={() => void finish()}>{busy ? "Saving…" : "Finish set"}</button></div></Modal>}
  </div>;
}
