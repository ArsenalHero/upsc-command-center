import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  Search,
  Download,
  BookOpen,
  Clock3,
  CheckCircle2,
  RotateCcw,
  Flag,
  ExternalLink,
  Plus,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { useAuth } from "../hooks/useAuth";
import type { PYQDraft, PYQRecord } from "../types";
import { errorTypes } from "../types";
import {
  PageHeader,
  DashboardCard,
  Badge,
  ProgressBar,
  EmptyState,
} from "../components/ui";
import { RecordTable } from "../components/RecordTable";
import { exportCSV } from "../services/export";
import { prettyDate, round } from "../utils/date";
import {
  ActiveTimer,
  attemptStats,
  formatSeconds,
  latestAttempts,
  makeAttempt,
  newDraft,
  nextDraft,
  type PYQQuestion,
} from "../utils/pyq";
import bankData from "../data/pyq-bank.json";
const bank = bankData as PYQQuestion[];
const byId = new Map(bank.map((q) => [q.id, q]));
const outcomes: Record<string, string> = {
  correct: "Right",
  incorrect: "Wrong",
  skipped: "Skipped",
  ungraded: "Unmarked",
  written: "Written",
};
const tone = (outcome: string) =>
  outcome === "correct"
    ? "green"
    : outcome === "incorrect"
      ? "red"
      : outcome === "skipped"
        ? "amber"
        : "blue";
const original =
  "https://www.upsc.gov.in/examinations/previous-question-papers";
function OriginalQuestion({ q }: { q: PYQQuestion }) {
  return (
    <div className="pyq-question-text">
      {q.imageSlices?.length ? (
        <>
          <div className="pyq-paper-images">
            {q.imageSlices.map((slice, i) => (
              <svg
                key={i}
                viewBox={`${slice.x} ${slice.y} ${slice.width} ${slice.height}`}
                role="img"
                aria-label={
                  i === 0
                    ? `Original UPSC question ${q.number}. ${q.question}`
                    : "Question continued"
                }
              >
                <image
                  href={`${import.meta.env.BASE_URL || "./"}${slice.url}`}
                  width={slice.imageWidth}
                  height={slice.imageHeight}
                />
              </svg>
            ))}
          </div>
          <details className="pyq-transcript">
            <summary>Read text transcription</summary>
            <p>{q.question}</p>
            <p className="muted small">
              Text extracted from the scan may contain transcription errors. The
              original paper image above is the reference.
            </p>
          </details>
        </>
      ) : (
        <p>{q.question}</p>
      )}
      <a
        className="small pyq-source"
        href={`${q.sourceUrl}#page=${q.page}`}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink size={13} />
        UPSC paper · page {q.page}
        {q.sourceUrl.includes("shankar") ? " (mirror)" : ""}
      </a>
    </div>
  );
}
export default function PYQs() {
  const { data, savePYQDraft, setEditor, saveRecord } = useData();
  const { guest } = useAuth();
  const [tab, setTab] = useState("Subjectwise"),
    [subject, setSubject] = useState(""),
    [year, setYear] = useState(""),
    [stage, setStage] = useState(""),
    [status, setStatus] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [practising, setPractising] = useState(false),
    [fresh, setFresh] = useState(false);
  const latest = useMemo(() => latestAttempts(data.pyqs), [data.pyqs]);
  const scoped = useMemo(
    () =>
      bank.filter(
        (q) =>
          (!subject || q.subject === subject) &&
          (!year || q.year === Number(year)) &&
          (!stage || q.stage === stage) &&
          (!query ||
            `${q.question} ${q.subject} ${q.topic}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [subject, year, stage, query],
  );
  const filtered = scoped.filter((q) => {
    const p = latest.get(q.id);
    return (
      !status ||
      (status === "new"
        ? !p
        : status === "revision"
          ? !!p?.revisionNeeded
          : p?.attempt?.outcome === status)
    );
  });
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 10) - 1),
  );
  const ids = new Set(scoped.map((q) => q.id));
  const records = data.pyqs.filter(
    (p) => p.attempt && ids.has(p.attempt.questionId),
  );
  const stats = attemptStats(records);
  const change = (setter: (s: string) => void, value: string) => {
    setter(value);
    setPage(0);
  };
  const start = (questions: PYQQuestion[]) => {
    if (!questions.length) return;
    if (savePYQDraft(newDraft(questions.map((q) => q.id)))) {
      setFresh(true);
      setPractising(true);
    }
  };
  const groups = [
    ...new Set(
      bank.map((q) => (tab === "Yearwise" ? String(q.year) : q.subject)),
    ),
  ].sort((a, b) =>
    tab === "Yearwise" ? Number(b) - Number(a) : a.localeCompare(b),
  );
  if (practising && data.pyqDraft)
    return (
      <PracticeSession fresh={fresh} onClose={() => setPractising(false)} />
    );
  return (
    <>
      <PageHeader
        eyebrow="OFFICIAL PAPERS · YOUR PRACTICE HISTORY"
        title="Previous year questions"
        description="Practise by subject or year. Every submitted attempt keeps its answer, result, time, and review notes."
        action={
          <button
            className="btn secondary"
            onClick={() => setEditor({ collection: "pyqs" })}
          >
            <Plus size={16} />
            Log outside practice
          </button>
        }
      />
      <div className="pyq-coverage card">
        <BookOpen size={23} />
        <div>
          <strong>{bank.length} questions ready to practise</strong>
          <p>
            Prelims GS-I: 2024 & 2025, complete papers · Mains GS-II: 2025,
            complete paper. Subject tags are study categories assigned here.{" "}
            <a href={original} target="_blank" rel="noreferrer">
              All official UPSC papers ↗
            </a>
          </p>
        </div>
      </div>
      <p className="pyq-save-note">
        <CheckCircle2 size={15} />
        {guest
          ? "Guest mode: attempts are saved in this browser. Export a backup to keep a separate copy."
          : "Attempts are saved to your preparation workspace. Check Account for cloud sync status."}
      </p>
      {data.pyqDraft &&
        data.pyqDraft.index < data.pyqDraft.questionIds.length && (
          <section className="card pyq-resume">
            <div>
              <strong>Your practice is waiting</strong>
              <p>
                Question {data.pyqDraft.index + 1} of{" "}
                {data.pyqDraft.questionIds.length} · timer resumes paused
              </p>
            </div>
            <button
              className="btn primary"
              onClick={() => {
                setFresh(false);
                setPractising(true);
              }}
            >
              <Play size={16} />
              Resume practice
            </button>
          </section>
        )}
      <div className="stats-grid four">
        <DashboardCard
          title="Unique questions practised"
          value={stats.unique}
          detail={`${stats.total} saved attempts`}
        />
        <DashboardCard
          title="Right / wrong"
          value={`${stats.correct} / ${stats.incorrect}`}
          detail={`${stats.skipped} skipped · ${stats.ungraded} unmarked · ${stats.written} written`}
        />
        <DashboardCard
          title="Accuracy"
          value={stats.accuracy === null ? "—" : `${round(stats.accuracy)}%`}
          detail={`${stats.selfMarked} self-marked results included; skipped and unmarked excluded`}
        />
        <DashboardCard
          title="Time per question"
          value={
            stats.averageSeconds === null
              ? "—"
              : formatSeconds(stats.averageSeconds)
          }
          detail={`${formatSeconds(stats.seconds)} active time · ${stats.flagged} revision flags`}
        />
      </div>
      <nav className="tabs" aria-label="PYQ views">
        {["Subjectwise", "Yearwise", "History", "Manual logs"].map((name) => (
          <button
            className={tab === name ? "active" : ""}
            aria-pressed={tab === name}
            key={name}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === "Manual logs" ? (
        <RecordTable
          collection="pyqs"
          records={data.pyqs.filter((p) => !p.attempt)}
          title="Outside practice & existing PYQ logs"
          columns={[
            { key: "year", label: "Year" },
            { key: "question", label: "Question / batch" },
            { key: "correct", label: "Right" },
            { key: "incorrect", label: "Wrong" },
            { key: "conceptGap", label: "Concept gap" },
          ]}
        />
      ) : (
        <>
          <section
            className="card pyq-filters"
            aria-label="Question bank filters"
          >
            <label>
              <span>Subject</span>
              <select
                aria-label="PYQ subject"
                value={subject}
                onChange={(e) => change(setSubject, e.target.value)}
              >
                <option value="">All subjects</option>
                {[...new Set(bank.map((q) => q.subject))].sort().map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Year</span>
              <select
                aria-label="PYQ year"
                value={year}
                onChange={(e) => change(setYear, e.target.value)}
              >
                <option value="">All years</option>
                {[...new Set(bank.map((q) => q.year))]
                  .sort((a, b) => b - a)
                  .map((y) => (
                    <option key={y}>{y}</option>
                  ))}
              </select>
            </label>
            <label>
              <span>Paper</span>
              <select
                aria-label="PYQ stage"
                value={stage}
                onChange={(e) => change(setStage, e.target.value)}
              >
                <option value="">All papers</option>
                <option value="Prelims">Prelims GS-I</option>
                <option value="Mains">Mains GS-II</option>
              </select>
            </label>
            <label>
              <span>Practice status</span>
              <select
                aria-label="PYQ status"
                value={status}
                onChange={(e) => change(setStatus, e.target.value)}
              >
                <option value="">All questions</option>
                <option value="new">Not attempted</option>
                <option value="incorrect">Wrong last time</option>
                <option value="correct">Right last time</option>
                <option value="skipped">Skipped last time</option>
                <option value="ungraded">Unmarked</option>
                <option value="written">Written</option>
                <option value="revision">Revision needed</option>
              </select>
            </label>
            <label className="pyq-search">
              <span>Search questions & topics</span>
              <div>
                <Search size={16} />
                <input
                  aria-label="Search PYQ bank"
                  value={query}
                  onChange={(e) => change(setQuery, e.target.value)}
                  placeholder="Parliament, climate, inflation…"
                />
              </div>
            </label>
            <button
              className="btn secondary small-btn"
              onClick={() => {
                setSubject("");
                setYear("");
                setStage("");
                setStatus("");
                setQuery("");
                setPage(0);
              }}
            >
              Reset filters
            </button>
          </section>
          {tab === "History" ? (
            <AttemptHistory
              records={records.filter(
                (r) =>
                  !status ||
                  (status === "revision"
                    ? r.revisionNeeded
                    : status === "new"
                      ? false
                      : r.attempt!.outcome === status),
              )}
              onPractise={(id) => {
                const q = byId.get(id);
                if (q) start([q]);
              }}
              onReview={(r) =>
                saveRecord("pyqs", { ...r, revisionNeeded: !r.revisionNeeded })
              }
            />
          ) : (
            <>
              <div className="pyq-group-grid">
                {groups.map((group) => {
                  const qs = scoped.filter((q) =>
                    tab === "Yearwise"
                      ? String(q.year) === group
                      : q.subject === group,
                  );
                  if (!qs.length) return null;
                  const s = attemptStats(
                    records.filter((r) =>
                      qs.some((q) => q.id === r.attempt!.questionId),
                    ),
                  );
                  const selected =
                    tab === "Yearwise" ? year === group : subject === group;
                  return (
                    <button
                      className={`card pyq-group ${selected ? "selected" : ""}`}
                      aria-pressed={selected}
                      key={group}
                      onClick={() =>
                        change(
                          tab === "Yearwise" ? setYear : setSubject,
                          selected ? "" : group,
                        )
                      }
                    >
                      <div>
                        <strong>{group}</strong>
                        <ChevronRight size={16} />
                      </div>
                      <p>
                        {qs.length} questions · {s.unique} practised
                      </p>
                      <ProgressBar value={(s.unique / qs.length) * 100} />
                      <span>
                        {s.accuracy === null
                          ? "Ready when you are"
                          : `${round(s.accuracy)}% accuracy · ${s.incorrect} wrong`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="section-heading">
                <div>
                  <h2>{filtered.length} questions</h2>
                  <p className="small muted">
                    Filters use the most recent result; history keeps every
                    attempt.
                  </p>
                </div>
                <button
                  className="btn primary"
                  disabled={!filtered.length}
                  onClick={() => start(filtered)}
                >
                  <Play size={16} />
                  {status === "incorrect"
                    ? "Reattempt wrong questions"
                    : "Practise filtered questions"}
                </button>
              </div>
              {filtered.length ? (
                <section className="card pyq-bank-list">
                  {filtered
                    .slice(currentPage * 10, currentPage * 10 + 10)
                    .map((q) => {
                      const p = latest.get(q.id);
                      return (
                        <article className="pyq-bank-row" key={q.id}>
                          <div className="pyq-row-number">
                            {q.year}
                            <strong>Q{q.number}</strong>
                          </div>
                          <div className="pyq-row-content">
                            <div className="pyq-badges">
                              <Badge tone="blue">{q.subject}</Badge>
                              <span className="small muted">
                                {q.paper}{" "}
                                {q.booklet ? `· Set ${q.booklet}` : ""}
                              </span>
                              {q.keyStatus === "dropped" && (
                                <Badge tone="amber">
                                  Dropped from official scoring
                                </Badge>
                              )}
                              {p?.attempt && (
                                <Badge tone={tone(p.attempt.outcome)}>
                                  {outcomes[p.attempt.outcome]}
                                </Badge>
                              )}
                              {p?.revisionNeeded && <Flag size={13} />}
                            </div>
                            <p>
                              {q.question.replace(/\s+/g, " ").slice(0, 210)}
                              {q.question.length > 210 ? "…" : ""}
                            </p>
                            <span className="small muted">
                              {q.topic}
                              {p?.attempt
                                ? ` · Last time ${formatSeconds(p.attempt.seconds)} · ${data.pyqs.filter((r) => r.attempt?.questionId === q.id).length} attempts`
                                : ""}
                            </span>
                          </div>
                          <button
                            className="btn secondary small-btn"
                            aria-label={`Practise ${q.year} ${q.paper} question ${q.number}`}
                            onClick={() => start([q])}
                          >
                            Practise
                            <ChevronRight size={14} />
                          </button>
                        </article>
                      );
                    })}
                  <div className="pyq-pagination">
                    <button
                      className="btn secondary small-btn"
                      disabled={currentPage === 0}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={14} />
                      Previous
                    </button>
                    <span>
                      Page {currentPage + 1} of{" "}
                      {Math.ceil(filtered.length / 10)}
                    </span>
                    <button
                      className="btn secondary small-btn"
                      disabled={(currentPage + 1) * 10 >= filtered.length}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Next
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </section>
              ) : (
                <EmptyState
                  title="No questions match these filters."
                  text="Choose a different subject, year, or practice status."
                />
              )}
              <p className="chart-note">
                2024 answers follow the UPSC Series A key. Dropped questions are
                excluded from accuracy. The 2025 Prelims key is not connected
                here; those attempts can be self-marked or left unmarked. Mains
                answers use optional self-assessed marks.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
function PracticeSession({
  onClose,
  fresh,
}: {
  onClose: () => void;
  fresh: boolean;
}) {
  const { data, saveRecord } = useData();
  const [autoStart, setAutoStart] = useState(fresh);
  const [position, setPosition] = useState(data.pyqDraft!);
  const q = byId.get(position.questionIds[position.index]);
  const attempts = data.pyqs.filter(
    (r) => r.attempt?.sessionId === position.sessionId,
  );
  const stats = attemptStats(attempts);
  const [lastResult, setLastResult] = useState<PYQRecord | null>(null);
  if (position.index >= position.questionIds.length)
    return (
      <>
        <PageHeader
          eyebrow="PRACTICE SAVED"
          title="Practice complete"
          description="Every attempt is in your PYQ history. Reattempts keep earlier results."
        />
        <div className="stats-grid four">
          <DashboardCard title="Saved attempts" value={stats.total} />
          <DashboardCard
            title="Right / wrong"
            value={`${stats.correct} / ${stats.incorrect}`}
            detail={`${stats.skipped} skipped · ${stats.ungraded} unmarked · ${stats.written} written`}
          />
          <DashboardCard
            title="Accuracy"
            value={stats.accuracy === null ? "—" : `${round(stats.accuracy)}%`}
          />
          <DashboardCard
            title="Active time"
            value={formatSeconds(stats.seconds)}
            detail={`${stats.flagged} flagged for revision`}
          />
        </div>
        <button className="btn primary" onClick={onClose}>
          <ChevronLeft size={16} />
          Back to question bank
        </button>
        <AttemptHistory
          records={attempts}
          onReview={(r) =>
            saveRecord("pyqs", { ...r, revisionNeeded: !r.revisionNeeded })
          }
        />
      </>
    );
  if (!q)
    return (
      <EmptyState
        title="This question is no longer in the bank."
        text="Your submitted attempts are safe in History."
        action="Back to bank"
        onAction={onClose}
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="TIMED PYQ PRACTICE"
        title={`${q.year} · ${q.paper}`}
        description={`Question ${position.index + 1} of ${position.questionIds.length} · Original Q${q.number}${q.booklet ? ` · Set ${q.booklet}` : ""}`}
        action={
          <button className="btn secondary" onClick={onClose}>
            <ChevronLeft size={16} />
            Save & exit
          </button>
        }
      />
      <ProgressBar
        value={(attempts.length / position.questionIds.length) * 100}
        label="Practice progress"
        detail={`${attempts.length} of ${position.questionIds.length} saved`}
      />
      <QuestionPractice
        key={`${position.sessionId}-${position.index}`}
        q={q}
        initial={position}
        autoStart={autoStart}
        onSaved={(r) => setLastResult(r)}
        onNext={() => {
          setPosition(data.pyqDraft!);
          setLastResult(null);
          setAutoStart(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
      {lastResult && (
        <p className="chart-note">
          Saved: {outcomes[lastResult.attempt!.outcome]} ·{" "}
          {formatSeconds(lastResult.attempt!.seconds)}. Your next question is
          ready.
        </p>
      )}
    </>
  );
}
function QuestionPractice({
  q,
  initial,
  onSaved,
  onNext,
  autoStart,
}: {
  q: PYQQuestion;
  initial: PYQDraft;
  autoStart: boolean;
  onSaved: (r: PYQRecord) => void;
  onNext: () => void;
}) {
  const { data, savePYQDraft, submitPYQ, saveRecord } = useData();
  const [draft, setDraft] = useState(initial),
    [running, setRunning] = useState(false),
    [seconds, setSeconds] = useState(initial.seconds),
    [result, setResult] = useState<PYQRecord | null>(null),
    [error, setError] = useState("");
  const ref = useRef(draft),
    timer = useRef(new ActiveTimer(initial.seconds)),
    saved = useRef(false),
    busy = useRef(false),
    checkpoint = useRef(savePYQDraft);
  checkpoint.current = savePYQDraft;
  const snapshot = () => ({
    ...ref.current,
    seconds: timer.current.seconds(performance.now()),
  });
  useEffect(() => {
    let last = performance.now();
    if (autoStart && !document.hidden) {
      timer.current.start(performance.now());
      setRunning(true);
    }
    const pause = () => {
      timer.current.pause(performance.now());
      setRunning(false);
      if (!saved.current) checkpoint.current(snapshot());
    };
    const visibility = () => {
      if (document.hidden) pause();
    };
    const tick = setInterval(() => {
      const now = performance.now();
      setSeconds(timer.current.seconds(now));
      if (now - last >= 10000) {
        if (!saved.current) checkpoint.current(snapshot());
        last = now;
      }
    }, 250);
    window.addEventListener("beforeunload", pause);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(tick);
      window.removeEventListener("beforeunload", pause);
      document.removeEventListener("visibilitychange", visibility);
      timer.current.pause(performance.now());
      if (!saved.current) checkpoint.current(snapshot());
    };
  }, []);
  const change = (patch: Partial<PYQDraft>) => {
    const next = { ...snapshot(), ...patch };
    ref.current = next;
    setDraft(next);
    if (!saved.current) checkpoint.current(next);
  };
  const toggle = () => {
    if (running) {
      timer.current.pause(performance.now());
      setRunning(false);
      checkpoint.current(snapshot());
    } else {
      timer.current.start(performance.now());
      setRunning(true);
    }
    setSeconds(timer.current.seconds(performance.now()));
  };
  const submit = (skip = false) => {
    if (busy.current || saved.current) return;
    busy.current = true;
    timer.current.pause(performance.now());
    setRunning(false);
    try {
      const current = snapshot();
      const r = makeAttempt(q, current, data.subjects, skip);
      if (submitPYQ(r, nextDraft(current))) {
        saved.current = true;
        ref.current = { ...current, revisionNeeded: r.revisionNeeded };
        setDraft(ref.current);
        setResult(r);
        onSaved(r);
        setError("");
      } else
        setError(
          "This attempt was not saved. Check the workspace notice, then try again.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
      setSeconds(timer.current.seconds(performance.now()));
    }
  };
  const a = result?.attempt;
  return (
    <section className="card pyq-practice">
      <div className="pyq-practice-heading">
        <div className="pyq-badges">
          <Badge tone="blue">{q.subject}</Badge>
          <span className="small muted">
            {q.topic} · {q.marks} marks
            {q.wordLimit ? ` · ${q.wordLimit} words` : ""}
          </span>
        </div>
        <div className="pyq-timer">
          <Clock3 size={17} />
          <strong aria-label="Question active time">
            {formatSeconds(seconds)}
          </strong>
          <button
            className="btn secondary small-btn"
            disabled={!!result}
            onClick={toggle}
          >
            {running ? <Pause size={14} /> : <Play size={14} />}{" "}
            {running
              ? "Pause timer"
              : seconds > 0
                ? "Resume timer"
                : "Start timer"}
          </button>
        </div>
      </div>
      <p className="small muted pyq-timer-note">
        Active time only. New questions start the timer automatically. It pauses
        when this tab is hidden and resumes paused after a reload.
      </p>
      <OriginalQuestion q={q} />
      <fieldset className="pyq-answer-fields">
        {q.stage === "Mains" ? (
          <>
            <label>
              Your answer
              <textarea
                aria-label="Mains PYQ answer"
                disabled={!!result}
                value={draft.response}
                rows={10}
                maxLength={180000}
                onChange={(e) => change({ response: e.target.value })}
              />
              <span className="small muted">
                {draft.response.trim()
                  ? draft.response.trim().split(/\s+/).length
                  : 0}{" "}
                words / {q.wordLimit} suggested
              </span>
            </label>
            <label>
              Self-assessed marks (optional)
              <input
                aria-label="Mains self-assessed marks"
                disabled={!!result}
                type="number"
                min={0}
                max={q.marks}
                step="0.5"
                value={draft.selfScore}
                onChange={(e) => change({ selfScore: e.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <legend>Choose an answer from the original paper above</legend>
            <div className="pyq-options">
              {["a", "b", "c", "d"].map((option) => (
                <label
                  className={`pyq-option ${draft.selectedOption === option ? "selected" : ""} ${a?.answerOption === option ? "answer-right" : ""}`}
                  key={option}
                >
                  <input
                    type="radio"
                    disabled={!!result}
                    name="pyq-option"
                    value={option}
                    checked={draft.selectedOption === option}
                    onChange={() => change({ selectedOption: option })}
                  />
                  <span>Option {option.toUpperCase()}</span>
                </label>
              ))}
            </div>
            {q.keyStatus === "pending" && (
              <label>
                Marking for this question
                <select
                  aria-label="Self marking"
                  disabled={!!result}
                  value={draft.selfOutcome}
                  onChange={(e) =>
                    change({
                      selfOutcome: e.target.value as PYQDraft["selfOutcome"],
                    })
                  }
                >
                  <option value="">Leave unmarked — key not connected</option>
                  <option value="correct">Right — self-assessed</option>
                  <option value="incorrect">Wrong — self-assessed</option>
                </select>
                <span className="small muted">
                  Self-mark only after checking a reliable answer key. The
                  choice and time are kept even if left unmarked.
                </span>
              </label>
            )}
            {q.keyStatus === "dropped" && (
              <p className="form-note">
                UPSC dropped this question. Practice is saved unmarked and
                excluded from accuracy.
              </p>
            )}
          </>
        )}
        <div className="pyq-review-grid">
          <label>
            Confidence
            <select
              aria-label="Question confidence"
              value={draft.confidence}
              onChange={(e) => change({ confidence: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} / 5{n === 1 ? " · Guessing" : n === 5 ? " · Certain" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Difficulty
            <select
              aria-label="Question difficulty"
              value={draft.difficulty}
              onChange={(e) => change({ difficulty: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} / 5{n === 1 ? " · Easy" : n === 5 ? " · Hard" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mistake category
            <select
              aria-label="Question mistake category"
              value={draft.errorType}
              onChange={(e) => change({ errorType: e.target.value })}
            >
              <option value="">Not classified</option>
              {errorTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Notes / concept gap
          <textarea
            aria-label="Question notes"
            value={draft.notes}
            rows={3}
            maxLength={10000}
            placeholder="What would help you solve this next time?"
            onChange={(e) => change({ notes: e.target.value })}
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={draft.revisionNeeded}
            onChange={(e) => change({ revisionNeeded: e.target.checked })}
          />
          Flag for revision (wrong answers are flagged automatically)
        </label>
      </fieldset>
      {result && (
        <button
          className="btn secondary small-btn pyq-review-save"
          onClick={() => {
            const updated = {
              ...result,
              difficulty: draft.difficulty,
              conceptGap: draft.notes,
              revisionNeeded: draft.revisionNeeded,
              attempt: {
                ...result.attempt!,
                confidence: draft.confidence,
                errorType: draft.errorType,
                notes: draft.notes,
              },
            };
            if (saveRecord("pyqs", updated)) {
              setResult(updated);
              onSaved(updated);
            }
          }}
        >
          Save review notes
        </button>
      )}
      {error && (
        <p className="pyq-error" role="alert">
          {error}
        </p>
      )}
      {a ? (
        <div className={`pyq-result ${tone(a.outcome)}`} role="status">
          <div>
            <Badge tone={tone(a.outcome)}>{outcomes[a.outcome]}</Badge>
            <strong>
              {a.grading === "official"
                ? `UPSC answer: ${a.answerOption.toUpperCase()}`
                : a.grading === "self"
                  ? "Self-assessed result"
                  : a.outcome === "skipped"
                    ? "Skipped and saved"
                    : "Saved without automatic marking"}
            </strong>
            <span>
              {formatSeconds(a.seconds)} active time · confidence {a.confidence}
              /5
              {a.selfScore !== null
                ? ` · ${a.selfScore}/${a.maximum} self-assessed marks`
                : ""}
            </span>
            {q.keyUrl && (
              <a href={q.keyUrl} target="_blank" rel="noreferrer">
                View UPSC answer key ↗
              </a>
            )}
          </div>
          <button className="btn primary" onClick={onNext}>
            {initial.index + 1 < initial.questionIds.length
              ? "Next question"
              : "Finish practice"}
            <ChevronRight size={16} />
          </button>
        </div>
      ) : (
        <div className="pyq-practice-actions">
          <button className="btn secondary" onClick={() => submit(true)}>
            Skip & save time
          </button>
          <button className="btn primary" onClick={() => submit()}>
            {q.stage === "Mains" ? "Save answer" : "Submit answer"}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
function AttemptHistory({
  records,
  onPractise,
  onReview,
}: {
  records: PYQRecord[];
  onPractise?: (id: string) => void;
  onReview: (r: PYQRecord) => void;
}) {
  const { data } = useData();
  const [page, setPage] = useState(0);
  const sorted = records
    .slice()
    .sort((a, b) =>
      b.attempt!.attemptedAt.localeCompare(a.attempt!.attemptedAt),
    );
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(sorted.length / 10) - 1),
  );
  return (
    <section className="card pyq-history">
      <div className="card-heading">
        <div>
          <h2>Attempt history</h2>
          <p>Every attempt is separate, including repeat questions.</p>
        </div>
        <button
          className="btn secondary small-btn"
          disabled={!records.length}
          onClick={() => exportCSV({ ...data, pyqs: records }, "pyqs")}
        >
          <Download size={14} />
          Export attempts CSV
        </button>
      </div>
      {sorted.length ? (
        <div className="pyq-history-list">
          {sorted.slice(current * 10, current * 10 + 10).map((r) => {
            const a = r.attempt!;
            const q = byId.get(a.questionId);
            return (
              <details className="pyq-history-row" key={r.id}>
                <summary>
                  <span>
                    <strong>
                      {r.year} · {r.paper} · Q{a.questionNumber}
                    </strong>
                    <span className="small muted">
                      {prettyDate(r.date)} ·{" "}
                      {q?.subject ||
                        data.subjects.find((s) => s.id === r.subjectId)?.name ||
                        "Unassigned"}
                    </span>
                  </span>
                  <Badge tone={tone(a.outcome)}>{outcomes[a.outcome]}</Badge>
                  <span>{formatSeconds(a.seconds)}</span>
                </summary>
                <div className="pyq-history-detail">
                  <p>{r.question}</p>
                  <div className="pyq-history-metrics">
                    <span>
                      Your choice:{" "}
                      <strong>{a.selectedOption.toUpperCase() || "—"}</strong>
                    </span>
                    <span>
                      Marking: <strong>{a.grading}</strong>
                    </span>
                    <span>
                      Key:{" "}
                      <strong>{a.answerOption.toUpperCase() || "—"}</strong>
                    </span>
                    <span>
                      Confidence: <strong>{a.confidence}/5</strong>
                    </span>
                    <span>
                      Difficulty: <strong>{r.difficulty}/5</strong>
                    </span>
                    <span>
                      Mistake: <strong>{a.errorType || "—"}</strong>
                    </span>
                    {a.selfScore !== null && (
                      <span>
                        Self-assessed marks:{" "}
                        <strong>
                          {a.selfScore}/{a.maximum}
                        </strong>
                      </span>
                    )}
                  </div>
                  {a.notes && (
                    <p className="pyq-note">
                      <strong>Notes</strong> {a.notes}
                    </p>
                  )}
                  {a.response && (
                    <p className="pyq-written-answer">{a.response}</p>
                  )}
                  <div className="button-group">
                    <button
                      className="btn secondary small-btn"
                      onClick={() => onReview(r)}
                    >
                      <Flag size={13} />
                      {r.revisionNeeded
                        ? "Mark revision complete"
                        : "Flag for revision"}
                    </button>
                    {onPractise && q && (
                      <button
                        className="btn secondary small-btn"
                        onClick={() => onPractise(a.questionId)}
                      >
                        <RotateCcw size={13} />
                        Reattempt
                      </button>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No saved question attempts yet."
          text="Start practising a question to build your history."
        />
      )}
      {sorted.length > 10 && (
        <div className="pyq-pagination">
          <button
            className="btn secondary small-btn"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <span>
            Page {current + 1} of {Math.ceil(sorted.length / 10)}
          </span>
          <button
            className="btn secondary small-btn"
            disabled={(current + 1) * 10 >= sorted.length}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
