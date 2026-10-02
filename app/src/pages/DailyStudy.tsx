import { useMemo, useState } from "react";
import {
  Plus,
  Clock3,
  Target,
  Focus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { aggregate, emptyFilters } from "../utils/analytics";
import { dateKey, addDays, number, prettyDate } from "../utils/date";
import {
  PageHeader,
  DashboardCard,
  ChartCard,
  EmptyState,
  ProgressBar,
} from "../components/ui";
import { RecordTable } from "../components/RecordTable";
import { StudyDetails } from "../components/StudyDetails";
import { WeeklyStudyChart } from "../charts";
export default function DailyStudy() {
  const { data, setEditor } = useData(),
    [date, setDate] = useState(dateKey),
    [detail, setDetail] = useState<string | null>(null);
  const a = useMemo(() => aggregate(data, date, date), [data, date]),
    filters = { ...emptyFilters(), to: date };
  return (
    <>
      <PageHeader
        eyebrow="BUILD THE HABIT"
        title="Daily study"
        description="Plan your time. Record the work. Make the next session count."
        action={
          <button
            className="btn primary"
            onClick={() =>
              setEditor({ collection: "sessions", preset: { date } })
            }
          >
            <Plus size={17} />
            Add study session
          </button>
        }
      />
      <div className="date-navigation">
        <button
          className="icon-btn"
          aria-label="Previous day"
          onClick={() => setDate(addDays(date, -1))}
        >
          <ChevronLeft size={19} />
        </button>
        <input
          type="date"
          aria-label="Study date"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
        <button
          className="icon-btn"
          aria-label="Next day"
          onClick={() => setDate(addDays(date, 1))}
        >
          <ChevronRight size={19} />
        </button>
        <button className="text-btn" onClick={() => setDate(dateKey())}>
          Today
        </button>
      </div>
      <div className="stats-grid four">
        <DashboardCard
          title="Study hours"
          value={number(a.hours, "h")}
          icon={<Clock3 size={19} />}
          detail={`${number(a.plannedHours)}h planned`}
        >
          <ProgressBar
            value={a.plannedHours ? (a.hours / a.plannedHours) * 100 : 0}
          />
        </DashboardCard>
        <DashboardCard
          title="Questions"
          value={a.attempted}
          icon={<Target size={19} />}
          detail={`${number(a.accuracy, "%")} accuracy`}
        />
        <DashboardCard
          title="Focus"
          value={number(a.focus, " / 10")}
          icon={<Focus size={19} />}
          detail={`${a.distraction} distraction minutes`}
        />
        <DashboardCard
          title="Answers & revision"
          value={`${a.answers} / ${a.revisions}`}
          detail="Answers written / revisions completed"
        />
      </div>
      <div className="chart-grid two">
        <section className="card">
          <div className="card-heading">
            <h2>Your daily timeline</h2>
            <span className="small muted">{prettyDate(date)}</span>
          </div>
          {a.sessions.length ? (
            <div className="daily-timeline">
              {a.sessions
                .slice()
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((s) => (
                  <button
                    className="timeline-row"
                    key={s.id}
                    onClick={() =>
                      setEditor({ collection: "sessions", record: s })
                    }
                  >
                    <span className="timeline-time">
                      {s.startTime || "—"}
                      <small>{s.endTime}</small>
                    </span>
                    <span
                      className="timeline-mark"
                      style={{
                        background: data.subjects.find(
                          (x) => x.id === s.subjectId,
                        )?.color,
                      }}
                    />
                    <span className="timeline-content">
                      <strong>
                        {data.subjects.find((x) => x.id === s.subjectId)?.name}
                      </strong>
                      <small>
                        {s.activity} ·{" "}
                        {data.topics.find((x) => x.id === s.topicId)?.name}
                      </small>
                    </span>
                    <span>{s.actualMinutes} min</span>
                  </button>
                ))}
            </div>
          ) : (
            <EmptyState
              onAction={() =>
                setEditor({ collection: "sessions", preset: { date } })
              }
            />
          )}
        </section>
        <ChartCard
          title="This week's study"
          description="Daily recorded hours, stacked by study category. Select a day to view its sessions."
        >
          <WeeklyStudyChart data={data} filters={filters} onDay={setDetail} />
        </ChartCard>
      </div>
      <RecordTable
        collection="sessions"
        records={a.sessions}
        columns={[
          {
            key: "startTime",
            label: "Time",
            render: (r) => `${r.startTime || "—"} – ${r.endTime || "—"}`,
          },
          {
            key: "subjectId",
            label: "Subject",
            render: (r) => (
              <>
                <strong>
                  {data.subjects.find((s) => s.id === r.subjectId)?.name}
                </strong>
                <small>
                  {data.topics.find((t) => t.id === r.topicId)?.name}
                </small>
              </>
            ),
          },
          { key: "activity", label: "Activity" },
          { key: "actualMinutes", label: "Minutes" },
          { key: "focus", label: "Focus", render: (r) => `${r.focus}/10` },
        ]}
      />
      {detail && <StudyDetails date={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
