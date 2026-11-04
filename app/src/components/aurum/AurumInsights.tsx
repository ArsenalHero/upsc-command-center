import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Flag, History, RefreshCw, Search } from "lucide-react";
import type { GoldenAPI } from "../mock/GoldenCatalogue";
import { OutcomeBar, OutcomeGraphic } from "./OutcomeGraphic";
import { aurumAccuracy, type AurumAnalysis, type AurumFlagReceipt, type AurumHistory, type AurumOpenRequest, type AurumReview, type AurumReviewFilter } from "../../utils/aurum";

const root = "/tests/prelims/aurum";
const reviewFilters: [AurumReviewFilter, string][] = [["incorrect", "Wrong"], ["flagged", "Flagged"], ["all", "All questions"], ["correct", "Correct"], ["skipped", "Skipped"]];
const date = (value: string) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const percent = (value: number | null) => value === null ? "—" : `${Math.round(value)}%`;
const sourceName = (source: string) => source === "pyq" ? "PYQs" : source === "mock" ? "Mock questions" : "PYQs + mocks";

function useReport<T>(api: GoldenAPI, op: string, params: Record<string, unknown>) {
  const key = JSON.stringify(params), [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true; setLoading(true); setError("");
    api<T>(op, JSON.parse(key)).then(next => { if (live) setData(next); }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api, op, key, version]);
  return { data, setData, loading, error, setError, reload: () => setVersion(v => v + 1) };
}
function ReportError({ error, retry }: { error: string; retry: () => void }) {
  return error ? <div className="aurum-report-error" role="alert"><p>{error}</p><button className="text-btn" onClick={retry}><RefreshCw size={14} />Try again</button></div> : null;
}
function Pager({ offset, limit, total, busy, onPage }: { offset: number; limit: number; total: number; busy: boolean; onPage: (next: number) => void }) {
  return <div className="aurum-report-pagination"><button className="btn secondary" disabled={busy || offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>Previous</button><span>{total ? `${offset + 1}–${Math.min(offset + limit, total)} of ${total}` : "0 results"}</span><button className="btn secondary" disabled={busy || offset + limit >= total} onClick={() => onPage(offset + limit)}>Next</button></div>;
}
type Props = { api: GoldenAPI; view: "analysis" | "review"; opening: boolean; onOpen: (request: AurumOpenRequest) => Promise<void> };
export default function AurumInsights(props: Props) {
  return props.view === "review" ? <QuestionReview {...props} /> : <Analysis {...props} />;
}

function Analysis({ api, onOpen, opening }: Props) {
  const report = useReport<AurumAnalysis>(api, "aurum-analysis", {}), d = report.data;
  return <div className="aurum-insights">
    <div className="aurum-insights-heading"><div><h2>Your practice, at a glance</h2><p>Saved answers from all your Aurum sets, including unfinished practice.</p></div><button className="text-btn" onClick={report.reload} disabled={report.loading}><RefreshCw size={14} />Refresh analysis</button></div>
    <ReportError error={report.error} retry={report.reload} />
    {!d ? !report.error && <p className="card aurum-report-loading" role="status">Loading your practice analysis…</p> : <>
      <div className="aurum-metric-grid">
        <div className="card"><span>Questions reviewed</span><strong>{d.overall.answered.toLocaleString()}</strong><small>{d.completedSets} completed sets · {d.runningSets} ongoing</small></div>
        <div className="card"><span>Accuracy</span><strong>{percent(aurumAccuracy(d.overall))}</strong><small>{d.overall.correct + d.overall.incorrect} attempted questions</small></div>
        <Link className="card" to={`${root}/review?filter=incorrect`}><span>Wrong answers</span><strong>{d.overall.incorrect.toLocaleString()}</strong><small>Review your mistakes<ArrowRight size={12} /></small></Link>
        <Link className="card" to={`${root}/review?filter=flagged`}><span>Flagged questions</span><strong>{d.overall.flagged.toLocaleString()}</strong><small>Your saved review list<ArrowRight size={12} /></small></Link>
      </div>
      <div className="aurum-analysis-grid"><OutcomeGraphic summary={d.overall} /><section className="card aurum-subject-report"><div className="aurum-report-heading"><h3>Subject performance</h3><span>Accuracy of attempted answers</span></div>
        {!d.subjects.length ? <p className="aurum-report-note">Practise a subject to see its breakdown here.</p> : d.subjects.map(s => <Link key={s.name} to={`${root}/review?filter=incorrect&subject=${encodeURIComponent(s.name)}`}><div><strong>{s.name}</strong><span>{percent(aurumAccuracy(s))}</span></div><OutcomeBar summary={s} /><small>{s.correct} correct · {s.incorrect} wrong · {s.skipped} skipped</small></Link>)}
      </section></div>
      {d.sources.length > 0 && <section className="card aurum-source-report"><div className="aurum-report-heading"><h3>Practice by source</h3><span>What you have worked on</span></div><div>{d.sources.map(s => <Link key={s.name} to={`${root}/review?filter=all&source=${s.name}`}><div><strong>{sourceName(s.name)}</strong><span>{percent(aurumAccuracy(s))} accuracy</span></div><OutcomeBar summary={s} /><small>{s.correct + s.incorrect} attempted · {s.incorrect} wrong · {s.flagged} flagged</small></Link>)}</div></section>}
      {d.recent.length > 0 && <section className="card aurum-trend-card"><div className="aurum-report-heading"><h3>Recent set accuracy</h3><span>Last {d.recent.length} completed sets</span></div><div className="aurum-trend">{d.recent.map((s, i) => {
        const accuracy = aurumAccuracy(s.summary);
        return <button key={s.id} disabled={opening} title={`${date(s.startedAt)} · ${percent(accuracy)} accuracy`} onClick={() => void onOpen({ sessionId: s.id })} aria-label={`Review set ${i + 1}, ${percent(accuracy)} accuracy`}><strong>{percent(accuracy)}</strong><span><i style={{ height: `${accuracy ?? 0}%` }} /></span><small>Set {i + 1}</small></button>;
      })}</div><p className="aurum-report-note">Sets are shown from oldest to newest. A dash means no answers were attempted.</p></section>}
    </>}
    <HistoryList api={api} onOpen={onOpen} opening={opening} />
  </div>;
}
function HistoryList({ api, onOpen, opening }: Omit<Props, "view">) {
  const [offset, setOffset] = useState(0), report = useReport<AurumHistory>(api, "aurum-history", { limit: 10, offset });
  return <section className="card aurum-history-report"><div className="aurum-report-heading"><h3><History size={17} />Practice history</h3><span>Reopen any saved set</span></div>
    <ReportError error={report.error} retry={report.reload} />
    {report.loading ? <p className="aurum-report-note" role="status">Loading saved sets…</p> : report.data && <>
      {!report.data.items.length ? <div className="aurum-report-empty"><h4>No practice history yet</h4><p>Your saved sets and results will appear here.</p><Link className="btn primary" to={root}>Start practice<ArrowRight size={15} /></Link></div> : <div className="aurum-set-list">{report.data.items.map(s => <article key={s.id}>
        <div className="aurum-set-row-heading"><div><span className="eyebrow">{s.status === "completed" ? "COMPLETED" : "IN PROGRESS"} · {sourceName(s.source)}</span><h4>{s.subjects.join(" · ")}</h4><time dateTime={s.startedAt}>{date(s.startedAt)}</time></div><strong>{percent(aurumAccuracy(s.summary))}<small>accuracy</small></strong></div>
        <OutcomeBar summary={s.summary} /><div className="aurum-set-row-foot"><span>{s.summary.correct} correct · {s.summary.incorrect} wrong · {s.summary.skipped} skipped{s.flagged ? ` · ${s.flagged} flagged` : ""}</span><div>
          {s.summary.incorrect > 0 && <button className="text-btn" disabled={opening} onClick={() => void onOpen({ sessionId: s.id, filter: "incorrect" })}>Wrong questions ({s.summary.incorrect})</button>}
          {s.flagged > 0 && <button className="text-btn" disabled={opening} onClick={() => void onOpen({ sessionId: s.id, filter: "flagged" })}><Flag size={13} />Flagged ({s.flagged})</button>}
          <button className="btn secondary" disabled={opening} onClick={() => void onOpen({ sessionId: s.id })}>{s.status === "running" ? "Resume set" : "Review set"}<ArrowRight size={14} /></button>
        </div></div>
      </article>)}</div>}
      <Pager offset={offset} limit={report.data.limit} total={report.data.total} busy={report.loading || opening} onPage={setOffset} />
    </>}
  </section>;
}

function QuestionReview({ api, onOpen, opening }: Props) {
  const [params, setParams] = useSearchParams();
  const requested = params.get("filter") || "incorrect", filter = reviewFilters.some(([key]) => key === requested) ? requested as AurumReviewFilter : "incorrect";
  const subject = (params.get("subject") || "").slice(0, 100), source = ["pyq", "mock"].includes(params.get("source") || "") ? params.get("source")! : "";
  const search = (params.get("search") || "").slice(0, 200), rawPage = Number(params.get("page") || 0), page = Number.isInteger(rawPage) && rawPage >= 0 ? Math.min(rawPage, 8000) : 0;
  const [draft, setDraft] = useState(search), [saving, setSaving] = useState("");
  const query = { filter, subject, source, search, limit: 12, offset: page * 12 }, key = JSON.stringify(query), currentKey = useRef(key); currentKey.current = key;
  const report = useReport<AurumReview>(api, "aurum-review", query);
  function change(name: string, value: string) { setParams(old => { const next = new URLSearchParams(old); if (value) next.set(name, value); else next.delete(name); if (name !== "page") next.delete("page"); return next; }, { replace: true }); }
  useEffect(() => { setDraft(search); }, [search]);
  useEffect(() => { if (draft === search) return; const timer = setTimeout(() => change("search", draft), 250); return () => clearTimeout(timer); }, [draft, search]);
  async function flag(item: AurumReview["items"][number]) {
    setSaving(item.questionId); report.setError(""); const startedKey = key;
    try {
      const receipt = await api<AurumFlagReceipt>("aurum-flag", { sessionId: item.sessionId, questionId: item.questionId, flagged: !item.flagged });
      if (currentKey.current !== startedKey) return;
      if (filter === "flagged" && !receipt.flagged) { change("page", "0"); report.reload(); }
      else report.setData(previous => previous && ({ ...previous, counts: { ...previous.counts, flagged: previous.counts.flagged + (receipt.flagged ? 1 : -1) }, items: previous.items.map(q => q.questionId === item.questionId ? { ...q, flagged: receipt.flagged } : q) }));
    } catch (e) { report.setError((e as Error).message); }
    finally { setSaving(""); }
  }
  return <div className="aurum-insights">
    <div className="aurum-insights-heading"><div><h2>Your question review</h2><p>Revisit mistakes, see correct answers and keep a flagged list for later.</p></div><button className="text-btn" onClick={report.reload} disabled={report.loading || !!saving}><RefreshCw size={14} />Refresh questions</button></div>
    <section className="card aurum-review-controls"><div className="aurum-review-filters" role="group" aria-label="Review question filters">{reviewFilters.map(([value, label]) => <button key={value} disabled={!!saving} aria-pressed={filter === value} onClick={() => change("filter", value)}>{label}<span>{report.data?.counts[value] ?? "—"}</span></button>)}</div>
      <div className="aurum-review-search"><label><span>Subject</span><select aria-label="Review subject" disabled={!!saving} value={subject} onChange={e => change("subject", e.target.value)}><option value="">All practised subjects</option>{report.data?.subjects.map(s => <option key={s}>{s}</option>)}</select></label>
        <label><span>Source</span><select aria-label="Review source" disabled={!!saving} value={source} onChange={e => change("source", e.target.value)}><option value="">PYQs and mocks</option><option value="pyq">PYQs</option><option value="mock">Mock questions</option></select></label>
        <label><span>Find a question</span><div><Search size={15} /><input type="search" disabled={!!saving} maxLength={200} aria-label="Search saved questions" placeholder="Search question text…" value={draft} onChange={e => setDraft(e.target.value)} /></div></label>
      </div>
    </section>
    <ReportError error={report.error} retry={report.reload} />
    {report.loading ? <p className="card aurum-report-loading" role="status">Loading saved questions…</p> : report.data && <>
      {!report.data.items.length ? <section className="card aurum-report-empty"><h3>{filter === "flagged" ? "No flagged questions here" : filter === "incorrect" ? "No wrong answers here" : "No matching questions"}</h3><p>{filter === "flagged" ? "Flag a question during or after practice to save it here." : "Try another subject, source or review filter."}</p><Link className="btn secondary" to={root}>Back to practice</Link></section>
        : <div className="aurum-review-list">{report.data.items.map(item => <article className="card" key={`${item.sessionId}:${item.questionId}`}>
          <div className="aurum-review-item-heading"><div><span className={`aurum-outcome-tag ${item.outcome || "pending"}`}>{item.outcome === "incorrect" ? "Wrong" : item.outcome === "correct" ? "Correct" : item.outcome === "skipped" ? "Skipped" : "Not reviewed"}</span><span className="aurum-origin">{item.source.toUpperCase()}</span><span>{item.subject} · Q{item.questionNumber}</span></div>
            <button className={`aurum-flag-button ${item.flagged ? "flagged" : ""}`} aria-pressed={item.flagged} disabled={!!saving || opening} onClick={() => void flag(item)}><Flag size={15} />{saving === item.questionId ? "Saving…" : item.flagged ? "Flagged" : "Flag"}</button></div>
          <p className="aurum-review-stem">{item.stem}</p><div className="aurum-review-item-foot"><span>{item.topic} · <time dateTime={item.startedAt}>{date(item.startedAt)}</time></span><button className="btn secondary" disabled={opening || !!saving} onClick={() => void onOpen({ sessionId: item.sessionId, questionId: item.questionId, filter })}>Open question<ArrowRight size={14} /></button></div>
        </article>)}</div>}
      <Pager offset={page * 12} limit={report.data.limit} total={report.data.total} busy={!!saving || opening} onPage={offset => change("page", String(offset / 12))} />
    </>}
  </div>;
}
