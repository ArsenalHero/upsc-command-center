import { useMemo, useState } from "react";
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
