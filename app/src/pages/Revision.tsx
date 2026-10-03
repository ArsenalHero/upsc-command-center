import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  CalendarDays,
  Clock3,
  RotateCcw,
} from "lucide-react";
import { useData } from "../hooks/useData";
import {
  dateKey,
  addDays,
  monthStart,
  monthEnd,
  monthsAgo,
  weekStart,
  dateRange,
  prettyDate,
  number,
  daysBetween,
} from "../utils/date";
import { aggregate } from "../utils/analytics";
import { revisionStages } from "../types";
import {
  PageHeader,
  DashboardCard,
  EmptyState,
  Badge,
  ChartCard,
} from "../components/ui";
import { RecordTable } from "../components/RecordTable";
import { TopicDetail } from "../components/TopicDetail";
import { defaultSpacedRepetition, validRepetitionDays } from "../utils/revision";

function SpacedRepetition() {
  const { data, updateSettings, notify } = useData();
  const saved = data.settings.spacedRepetition || defaultSpacedRepetition;
  const [enabled, setEnabled] = useState(saved.enabled), [days, setDays] = useState(String(saved.days));
  useEffect(() => { setEnabled(saved.enabled); setDays(String(saved.days)); }, [saved.enabled, saved.days]);
  const valid = days.trim() !== "" && validRepetitionDays(Number(days));
  const dirty = enabled !== saved.enabled || (enabled && Number(days) !== saved.days);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (enabled && !valid) return;
    if (updateSettings({ ...data.settings, spacedRepetition: { enabled, days: valid ? Number(days) : saved.days } }))
      notify("Spaced repetition settings saved.");
  };
  return <section className="card spaced-repetition" aria-labelledby="spaced-repetition-title">
    <div className="spaced-repetition-copy">
      <span className="eyebrow">BUILD A RECALL ROUTINE</span>
      <h2 id="spaced-repetition-title">Spaced repetition</h2>
      <p>Complete a revision and the same topic is automatically scheduled again after your chosen number of days.</p>
      <p className="small spaced-repetition-status" aria-live="polite"><Badge tone={saved.enabled ? "green" : "gray"}>{saved.enabled ? "On" : "Off"}</Badge>{saved.enabled ? `Saved interval: ${saved.days} ${saved.days === 1 ? "day" : "days"} after completion.` : "Turn it on when you want automatic repetition."}</p>
    </div>
    <form onSubmit={submit} className="spaced-repetition-form">
      <fieldset><legend>Automatic repetition</legend><div className="spaced-repetition-radios">
        <label><input type="radio" name="spaced-repetition" aria-label="Spaced repetition off" checked={!enabled} onChange={() => setEnabled(false)} />Off</label>
        <label><input type="radio" name="spaced-repetition" aria-label="Spaced repetition on" checked={enabled} onChange={() => setEnabled(true)} />On</label>
      </div></fieldset>
      <div className="spaced-repetition-interval"><label>Repeat after<input type="number" aria-label="Repetition interval in days" aria-describedby="spaced-repetition-help" min={1} max={365} step={1} required={enabled} disabled={!enabled} value={days} onChange={e => setDays(e.target.value)} /></label><span>days</span></div>
      <button className="btn primary" type="submit" disabled={!dirty || (enabled && !valid)}><RotateCcw size={16} />Save settings</button>
      <p className="small muted spaced-repetition-help" id="spaced-repetition-help">{enabled && !valid ? "Enter a whole number from 1 to 365 days." : dirty ? "Save settings to apply your choice." : saved.enabled ? `Complete a revision today → next revision ${prettyDate(addDays(dateKey(), saved.days))}.` : "Your choice applies to future revision completions."}</p>
    </form>
  </section>;
}
export function RevisionCalendar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (date: string) => void;
}) {
  const { data } = useData(),
    [month, setMonth] = useState(monthStart(selected));
  const start = weekStart(month),
    days = dateRange(start, addDays(start, 41)),
    today = dateKey();
  return (
    <section className="card revision-calendar">
      <div className="card-heading">
        <h2>{prettyDate(month, { month: "long", year: "numeric" })}</h2>
        <div className="button-group">
          <button
            className="icon-btn"
            aria-label="Previous month"
            onClick={() => setMonth(monthsAgo(month, 1))}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            className="text-btn"
            onClick={() => {
              setMonth(monthStart(today));
              onSelect(today);
            }}
          >
            Today
          </button>
          <button
            className="icon-btn"
            aria-label="Next month"
            onClick={() => setMonth(monthsAgo(month, -1))}
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((date) => {
          const records = data.revisions.filter((r) => r.dueDate === date),
            completed = records.filter((r) => r.completedDate).length,
            pending = records.length - completed;
          const status = pending
            ? date < today
              ? "Overdue"
              : date === today
                ? "Due today"
                : "Upcoming"
            : completed
              ? "Completed"
              : "";
          return (
            <button
              key={date}
              className={`calendar-day ${date.slice(0, 7) !== month.slice(0, 7) ? "outside" : ""} ${date === selected ? "selected" : ""} ${date === today ? "today" : ""}`}
              onClick={() => onSelect(date)}
              aria-label={`${prettyDate(date, { day: "numeric", month: "long" })}, ${records.length} revisions, ${status}`}
            >
              <span>{Number(date.slice(-2))}</span>
              {records.length > 0 && (
                <>
                  <strong
                    className={
                      pending
                        ? date < today
                          ? "red-text"
                          : "blue-text"
                        : "positive"
                    }
                  >
                    {records.length}
                    <span className="desktop-only"> topics</span>
                  </strong>
                  <small>{status}</small>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <Badge tone="red">Overdue</Badge>
        <Badge tone="amber">Due today</Badge>
        <Badge tone="blue">Upcoming</Badge>
        <Badge tone="green">Completed</Badge>
      </div>
    </section>
  );
}
export default function Revision() {
  const { data, setEditor, markRevision } = useData(),
    [selected, setSelected] = useState(dateKey),
    [topicId, setTopicId] = useState<string | null>(null);
  const today = dateKey(),
    pending = data.revisions.filter((r) => !r.completedDate),
    overdue = pending.filter((r) => r.dueDate < today),
    due = pending.filter((r) => r.dueDate === today),
    a = useMemo(
      () => aggregate(data, addDays(today, -29), today),
      [data, today],
    );
  const selectedRecords = data.revisions.filter((r) => r.dueDate === selected);
  return (
    <>
      <PageHeader
        eyebrow="MAKE KNOWLEDGE LAST"
        title="Revision planner"
        description="A clear calendar for recall, practice, and the next step toward mastery."
        action={
          <button
            className="btn primary"
            onClick={() =>
              setEditor({
                collection: "revisions",
                preset: { dueDate: selected },
              })
            }
          >
            <Plus size={16} />
            Schedule revision
          </button>
        }
      />
      <SpacedRepetition />
      <div className="stats-grid four">
        <DashboardCard
          title="Overdue revisions"
          value={overdue.length}
          tone="red"
          detail="Complete or reschedule"
        />
        <DashboardCard title="Due today" value={due.length} />
        <DashboardCard
          title="Upcoming"
          value={pending.filter((r) => r.dueDate > today).length}
        />
        <DashboardCard
          title="On-time revision health"
          value={number(a.revisionHealth, "%")}
          detail={`${a.revisionDue} due in the last 30 days`}
        />
      </div>
      <div className="revision-layout">
        <RevisionCalendar selected={selected} onSelect={setSelected} />
        <section className="card revision-agenda">
          <div className="card-heading">
            <h2>{prettyDate(selected, { day: "numeric", month: "long" })}</h2>
            <Badge>{selectedRecords.length} topics</Badge>
          </div>
          {selectedRecords.length ? (
            <div className="agenda-list">
              {selectedRecords.map((r) => (
                <article className="agenda-item" key={r.id}>
                  <Badge
                    tone={
                      r.completedDate
                        ? "green"
                        : r.dueDate < today
                          ? "red"
                          : r.dueDate === today
                            ? "amber"
                            : "blue"
                    }
                  >
                    {r.completedDate
                      ? "Completed"
                      : r.dueDate < today
                        ? "Overdue"
                        : r.dueDate === today
                          ? "Due today"
                          : "Upcoming"}
                  </Badge>
                  {r.repeatOf && <Badge tone="blue">Spaced repetition</Badge>}
                  <button
                    className="topic-name"
                    onClick={() => setTopicId(r.topicId)}
                  >
                    {data.topics.find((t) => t.id === r.topicId)?.name}
                  </button>
                  <p>
                    {data.subjects.find((s) => s.id === r.subjectId)?.name} ·{" "}
                    {r.stage}
                  </p>
                  <p className="small">{r.notes}</p>
                  {!r.completedDate ? (
                    <div className="button-group">
                      <button
                        className="btn secondary small-btn"
                        onClick={() =>
                          setEditor({ collection: "revisions", record: r })
                        }
                      >
                        Reschedule
                      </button>
                      <button
                        className="btn primary small-btn"
                        onClick={() => markRevision(r.id)}
                      >
                        <Check size={14} />
                        Complete
                      </button>
                    </div>
                  ) : (
                    <span className="small positive">
                      Completed {prettyDate(r.completedDate)}
                    </span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing scheduled."
              text="Choose a topic and plan your next recall session."
              action="Schedule revision"
              onAction={() =>
                setEditor({
                  collection: "revisions",
                  preset: { dueDate: selected },
                })
              }
            />
          )}
        </section>
      </div>
      <section className="card revision-lifecycle">
        <div className="card-heading">
          <h2>Learning to mastery</h2>
          <span className="small muted">Current topic stages</span>
        </div>
        <div className="lifecycle">
          {revisionStages.map((stage, i) => (
            <div key={stage}>
              <span>{i + 1}</span>
              <strong>
                {data.topics.filter((t) => t.revisionStage === stage).length}
              </strong>
              {stage}
            </div>
          ))}
        </div>
        <p className="chart-note">
          Open any syllabus topic to view and update its current stage.
        </p>
      </section>
      <RecordTable
        collection="revisions"
        title="All revision schedules"
        columns={[
          {
            key: "dueDate",
            label: "Due",
            render: (r) => prettyDate(r.dueDate),
          },
          {
            key: "topicId",
            label: "Topic",
            render: (r) => (
              <button
                className="topic-name"
                onClick={() => setTopicId(r.topicId)}
              >
                {data.topics.find((t) => t.id === r.topicId)?.name}
              </button>
            ),
          },
          { key: "stage", label: "Stage" },
          {
            key: "completedDate",
            label: "Status",
            render: (r) => (
              <Badge
                tone={
                  r.completedDate ? "green" : r.dueDate < today ? "red" : "blue"
                }
              >
                {r.completedDate
                  ? "Completed"
                  : r.dueDate < today
                    ? "Overdue"
                    : "Scheduled"}
              </Badge>
            ),
          },
        ]}
      />
      {topicId && <TopicDetail id={topicId} onClose={() => setTopicId(null)} />}
    </>
  );
}
