import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Bookmark, Check, ChevronDown, Clock3, GitCompareArrows, Play, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Modal } from "../ui";
import { fmtMock, mockKinds, mockPenaltyLabel, type MockHistory, type MockTest } from "../../utils/mockLab";
import { goldenBaseFilters, goldenFilterNames, readGoldenSearch, sortGoldenTests } from "../../utils/goldenGate";

export type GoldenAPI = <T>(op: string, p?: Record<string, unknown>) => Promise<T>;
type Catalogue = { tests: MockTest[]; facets: { coaching: { id: string; name: string }[]; years: number[]; series: string[]; subjects: string[]; topics: string[] } };
const empty: Catalogue = { tests: [], facets: { coaching: [], years: [], series: [], subjects: [], topics: [] } };
const root = "/tests/prelims";

function PersonalShortcuts({ api }: { api: GoldenAPI }) {
  const [history, setHistory] = useState<MockHistory[] | null>(null);
  useEffect(() => { let live = true; api<MockHistory[]>("history", { limit: 10, offset: 0 }).then(rows => { if (live) setHistory(Array.isArray(rows) ? rows : []); }).catch(() => { if (live) setHistory([]); }); return () => { live = false; }; }, [api]);
  const running = history?.find(a => a.status === "running"), latest = history?.find(a => a.status === "submitted");
  return <section className="golden-personal" aria-label="Your mock shortcuts">
    <Link to={running ? `${root}/${running.testId || "review"}/attempt/${running.id}` : `${root}/my-tests`}><span className="golden-shortcut-icon"><Play size={18} /></span><span><strong>{running ? "Resume saved test" : "My tests"}</strong><small>{running ? running.test.name : history === null ? "Loading your recent tests…" : "Your attempts, in one place"}</small></span><ArrowRight size={16} /></Link>
    <Link to={latest ? `${root}/${latest.testId || "review"}/result/${latest.id}` : `${root}/reports`}><span className="golden-shortcut-icon"><Sparkles size={18} /></span><span><strong>{latest ? "Latest score report" : "Performance reports"}</strong><small>{latest?.result ? `${fmtMock(latest.result.score)} / ${fmtMock(latest.result.maximum)} · ${fmtMock(latest.result.accuracy, "%")} accuracy` : "See what to improve next"}</small></span><ArrowRight size={16} /></Link>
    <Link to={`${root}/mistakes`}><span className="golden-shortcut-icon"><Bookmark size={18} /></span><span><strong>Review my mistakes</strong><small>Turn errors into your next revision</small></span><ArrowRight size={16} /></Link>
  </section>;
}

export function GoldenCatalogue({ view, api, userId, preparationYear, syllabus, demo }: { view: string; api: GoldenAPI; userId?: string; preparationYear: number; syllabus: (test: MockTest) => ReactNode; demo: ReactNode }) {
  const base = useMemo(() => goldenBaseFilters(view), [view]);
  const [filters, setFilters] = useState<Record<string, string>>(base), [page, setPage] = useState(0);
  const [catalog, setCatalog] = useState<Catalogue>(empty), [busy, setBusy] = useState(true), [error, setError] = useState(""), [reload, setReload] = useState(0);
  const [sort, setSort] = useState("default"), [selected, setSelected] = useState<MockTest[]>([]), [comparing, setComparing] = useState(false), [message, setMessage] = useState("");
  const storageKey = `golden-gate:search:${userId || "guest"}:${view}`;
  const [saved, setSaved] = useState<Record<string, string> | null>(() => { try { return readGoldenSearch(localStorage.getItem(storageKey)); } catch { return null; } });
  useEffect(() => {
    let live = true; setBusy(true); setError("");
    const timer = setTimeout(() => api<Catalogue>("catalog", { ...filters, limit: 12, offset: page * 12 }).then(d => { if (live) setCatalog(d?.facets && Array.isArray(d.tests) ? d : empty); }).catch(e => { if (live) setError((e as Error).message); }).finally(() => { if (live) setBusy(false); }), 180);
    return () => { live = false; clearTimeout(timer); };
  }, [api, filters, page, reload]);
  const change = (key: string, value: string) => { setPage(0); setFilters(f => ({ ...f, [key]: value })); };
  const apply = (next: Record<string, string>) => { setPage(0); setFilters({ ...base, ...next }); };
  const applied = Object.entries(filters).filter(([key, value]) => value && value !== base[key]);
  const visible = useMemo(() => sortGoldenTests(catalog.tests, sort), [catalog.tests, sort]);
  const fields: [string, string, string[][]][] = [
    ["paper", "Paper", ["GS-I", "CSAT"].map(s => [s, s])], ["kind", "Test type", mockKinds.map(s => [s, s])],
    ["subject", "Subject", catalog.facets.subjects.map(s => [s, s])], ["difficulty", "Difficulty", ["Easy", "Moderate", "Difficult", "Advanced"].map(s => [s, s])],
    ["coachingId", "Coaching", catalog.facets.coaching.map(c => [c.id, c.name])], ["year", "Year", catalog.facets.years.map(y => [String(y), String(y)])],
    ["series", "Series", catalog.facets.series.map(s => [s, s])], ["topic", "Topic", catalog.facets.topics.map(s => [s, s])],
    ["status", "Availability", ["active", "archived", "closed"].map(s => [s, s])],
  ];
  const field = ([key, label, options]: typeof fields[number]) => <label key={key}>{label}<select aria-label={`Mock ${label}`} value={filters[key] || ""} onChange={e => change(key, e.target.value)}><option value="">All {label.toLowerCase()}</option>{options.map(([value, name]) => <option value={value} key={value}>{name}</option>)}</select></label>;
  const toggleCompare = (test: MockTest) => {
    if (selected.some(t => t.id === test.id)) { setSelected(s => s.filter(t => t.id !== test.id)); setMessage(""); }
    else if (selected.length < 3) { setSelected(s => [...s, test]); setMessage(""); }
    else setMessage("Choose up to three tests. Remove one to compare another.");
  };
  const saveSearch = () => { try { const next = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)); localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); setMessage("Search saved in this browser."); } catch { setMessage("This browser could not save your search. Your filters are still applied."); } };
  const removeSaved = () => { try { localStorage.removeItem(storageKey); setSaved(null); setMessage("Saved search removed."); } catch { setMessage("The saved search could not be removed from this browser."); } };

  return <div className="golden-catalogue">
    <section className="golden-hero"><div><span className="eyebrow">PREPARE. TEST. REFINE.</span><h2>Your next mock.<br /><span>A clearer next step.</span></h2><p>Find the right GS or CSAT paper, compare your options, and build on what your last attempt taught you.</p><div className="golden-hero-points"><span><Clock3 size={15} />Timed practice</span><span><Check size={15} />Saved progress</span><span><GitCompareArrows size={15} />Compare before you start</span></div></div><div className="golden-gate-art" aria-hidden="true"><svg viewBox="0 0 180 190"><path d="M34 165V78a56 56 0 0 1 112 0v87M58 165V81a32 32 0 0 1 64 0v84" /><path d="M22 165h136M90 108v44m-14-30 14-14 14 14" /><circle cx="90" cy="25" r="7" /></svg><span>ONE MOCK AT A TIME</span></div></section>
    {userId && <PersonalShortcuts api={api} />}
    <section className="card mock-filters golden-filters" aria-label="Find a mock test">
      <label className="mock-search"><Search size={18} /><input type="search" maxLength={200} autoComplete="off" aria-label="Search mock tests" value={filters.search || ""} onChange={e => change("search", e.target.value)} placeholder="Search a test, code or syllabus…" />{filters.search && <button className="icon-btn" aria-label="Clear mock search" onClick={() => change("search", "")}><X size={17} /></button>}</label>
      <div className="golden-presets" role="group" aria-label="Quick mock filters"><span>Quick picks</span><button onClick={() => apply({ paper: "GS-I" })}>GS Paper I</button><button onClick={() => apply({ paper: "CSAT" })}>CSAT Paper II</button><button onClick={() => apply({ maxDuration: "60" })}><Clock3 size={13} />Up to 60m</button>{userId && <button onClick={() => apply({ participation: "Not Attempted" })}>Not attempted</button>}<button onClick={() => apply({ year: String(preparationYear) })}>{preparationYear} tests</button></div>
      <div className="mock-filter-grid golden-primary-filters">{fields.slice(0, 4).map(field)}</div>
      <details className="golden-more-filters"><summary><SlidersHorizontal size={15} />More filters<ChevronDown size={15} /></summary><div className="mock-filter-grid">{fields.slice(4).map(field)}{userId && <label>Attempt status<select aria-label="Mock attempt status" value={filters.participation || ""} onChange={e => change("participation", e.target.value)}><option value="">All statuses</option>{["Not Attempted", "Attempted", "Completed", "Bookmarked"].map(s => <option key={s}>{s}</option>)}</select></label>}<label>Minimum questions<input type="number" min={0} max={250} aria-label="Mock minimum questions" value={filters.minQuestions || ""} onChange={e => change("minQuestions", e.target.value)} /></label><label>Maximum minutes<input type="number" min={1} max={300} aria-label="Mock maximum minutes" value={filters.maxDuration || ""} onChange={e => change("maxDuration", e.target.value)} /></label></div></details>
      <div className="golden-filter-actions"><button className="text-btn" onClick={() => apply({})}>Reset filters</button><button className="text-btn" disabled={!Object.values(filters).some(Boolean)} onClick={saveSearch}><Bookmark size={14} />Save this search</button>{saved && <><button className="text-btn" onClick={() => apply(saved)}>Use saved search</button><button className="icon-btn" aria-label="Remove saved mock search" onClick={removeSaved}><X size={15} /></button></>}</div>
      {applied.length > 0 && <div className="golden-applied-filters" aria-label="Applied mock filters">{applied.map(([key, value]) => <button key={key} aria-label={`Remove mock ${goldenFilterNames[key]?.toLowerCase() || key} filter`} onClick={() => change(key, base[key] || "")}><span>{goldenFilterNames[key]}: {key === "coachingId" ? catalog.facets.coaching.find(c => c.id === value)?.name || "Selected coaching" : value}</span><X size={13} /></button>)}</div>}
    </section>
    {view === "coaching" && <div className="mock-directory">{catalog.facets.coaching.map(c => <button className="card" key={c.id} onClick={() => change("coachingId", c.id)}><strong>{c.name}</strong><span>Browse tests <ArrowRight size={14} /></span></button>)}</div>}
    {(view === "series" || view === "years") && <div className="mock-directory">{(view === "years" ? catalog.facets.years.map(String) : catalog.facets.series).map(value => <button className="card" key={value} onClick={() => change(view === "years" ? "year" : "series", value)}><strong>{value}</strong><span>View collection</span></button>)}</div>}
    <div className="golden-results-heading"><div><h2>Choose your next test</h2><p>{busy ? "Finding your mocks…" : `${visible.length} tests on this page${selected.length ? ` · ${selected.length} selected to compare` : ""}`}</p></div><label>Sort this page<select aria-label="Sort mock tests on this page" value={sort} onChange={e => setSort(e.target.value)}><option value="default">Schedule sequence</option><option value="duration">Shortest first</option><option value="year">Newest year first</option><option value="participants">Most participants</option></select></label></div>
    {message && <p className="golden-feedback" role="status">{message}</p>}
    {busy ? <div className="golden-loading" role="status"><span>Loading tests…</span><div>{[0, 1, 2].map(i => <div className="card golden-skeleton" key={i}><i /><i /><i /></div>)}</div></div> : error ? <section className="card golden-empty" role="alert"><h3>We couldn’t load the catalogue</h3><p>{error}</p><button className="btn secondary" onClick={() => setReload(n => n + 1)}>Retry catalogue</button></section> : !visible.length ? <section className="card golden-empty"><Search size={28} /><h3>No tests match your search</h3><p>Try fewer filters, a different paper, or another preparation year.</p><button className="btn secondary" onClick={() => apply({})}>Show all tests in this section</button></section> : <div className="mock-test-grid golden-test-grid">{visible.map(test => {
      const chosen = selected.some(t => t.id === test.id);
      return <article className="card mock-test-card golden-test-card" key={test.id}>
        <div className="mock-card-top"><span className={`mock-paper ${test.paper === "CSAT" ? "csat" : ""}`}>{test.paper}</span><span className={`golden-availability ${test.status === "active" ? "active" : ""}`}>{test.status}</span></div>
        <p className="eyebrow">{test.coaching} · {test.year}</p><h3>{test.name}</h3><p>{test.series} · {test.kind}</p>
        <div className="golden-subject-tags">{test.subjects.slice(0, 3).map(subject => <span key={subject}>{subject}</span>)}{test.subjects.length > 3 && <span>+{test.subjects.length - 3} subjects</span>}</div>
        <div className="mock-card-stats"><span><strong>{test.question_count}</strong>Questions</span><span><strong>{test.duration}<small>m</small></strong>Time</span><span><strong>{fmtMock(test.maximum)}</strong>Marks</span></div>
        {test.scheduled_at && <p className="golden-schedule"><CalendarDays size={14} aria-hidden="true"/><span>Scheduled <time dateTime={test.scheduled_at}>{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(test.scheduled_at))}</time></span></p>}
        <p className="golden-test-meta">{test.difficulty} · {test.participants} eligible submissions</p>
        <div className="button-group"><Link className="btn primary" to={`${root}/${test.id}`}>View test <ArrowRight size={15} /></Link>{syllabus(test)}</div>
        <div className="golden-card-tools"><button aria-pressed={chosen} aria-label={`Compare ${test.name}`} onClick={() => toggleCompare(test)}>{chosen ? <Check size={15} /> : <GitCompareArrows size={15} />}{chosen ? "Selected" : "Compare"}</button><Link to={`${root}/${test.id}/leaderboard`}>Rankings</Link>{userId && <button aria-label={`Toggle saved test ${test.name}`} onClick={async () => { try { await api("bookmark-test", { testId: test.id }); setMessage("Saved test preference updated. Use the Bookmarked attempt filter to find saved tests."); } catch (e) { setMessage((e as Error).message); } }}><Bookmark size={15} />Save / unsave</button>}</div>
      </article>;
    })}</div>}
    <div className="button-group mock-pagination"><button className="btn secondary" disabled={page === 0 || busy} onClick={() => setPage(p => p - 1)}>Previous tests</button><span>Page {page + 1}</span><button className="btn secondary" disabled={busy || catalog.tests.length <= 12} onClick={() => setPage(p => p + 1)}>Next tests</button></div>
    {selected.length > 0 && <section className="golden-compare-tray" aria-label="Selected tests to compare"><div><strong>Compare your options</strong><div>{selected.map(t => <button key={t.id} aria-label={`Remove ${t.name} from comparison`} onClick={() => toggleCompare(t)}>{t.name}<X size={13} /></button>)}</div></div><div className="button-group"><button className="text-btn" onClick={() => setSelected([])}>Clear</button><button className="btn primary" disabled={selected.length < 2} onClick={() => setComparing(true)}><GitCompareArrows size={16} />Compare {selected.length} tests</button></div></section>}
    {comparing && <Modal title="Compare mock tests" wide onClose={() => setComparing(false)}><div className="modal-body golden-comparison"><p>Compare the syllabus and time commitment before choosing a test.</p><div className="golden-comparison-scroll"><table><thead><tr><th scope="col">Test details</th>{selected.map(t => <th scope="col" key={t.id}>{t.name}</th>)}</tr></thead><tbody>{([ ["Paper", (t: MockTest) => t.paper], ["Type", (t: MockTest) => t.kind], ["Year", (t: MockTest) => String(t.year)], ["Questions", (t: MockTest) => String(t.question_count)], ["Duration", (t: MockTest) => `${t.duration} minutes`], ["Maximum marks", (t: MockTest) => fmtMock(t.maximum)], ["Difficulty", (t: MockTest) => t.difficulty], ["Subjects", (t: MockTest) => t.subjects.join(", ")], ["Syllabus", (t: MockTest) => t.syllabus || "Not supplied"], ["Marking", (t: MockTest) => `+${fmtMock(t.positive)} correct / −${mockPenaltyLabel(t.positive,t.negative)} incorrect / 0 blank`], ["Availability", (t: MockTest) => t.status], ] as [string, (t: MockTest) => string][]).map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{selected.map(t => <td key={t.id}>{value(t)}</td>)}</tr>)}<tr><th scope="row">Choose a test</th>{selected.map(t => <td key={t.id}><Link className="btn primary" onClick={() => setComparing(false)} to={`${root}/${t.id}`}>View test</Link></td>)}</tr></tbody></table></div><p className="small muted">The test screen shows question-specific marks. Comparison does not start a timer or change your attempts.</p></div><div className="modal-foot"><button className="btn secondary" onClick={() => setComparing(false)}>Close comparison</button></div></Modal>}
    <details className="golden-demo-preview"><summary>New here? Preview a sample report <ChevronDown size={16} /></summary>{demo}</details>
  </div>;
}
