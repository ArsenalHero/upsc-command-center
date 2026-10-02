import { useMemo, useState } from "react";
import { useData } from "../hooks/useData";
import {
  emptyFilters,
  subjectStats,
  insights,
  topicStats,
  aggregate,
} from "../utils/analytics";
import { number } from "../utils/date";
import {
  PageHeader,
  ChartCard,
  ProgressBar,
  Badge,
  StatusIcon,
  statusTone,
  EmptyState,
} from "../components/ui";
import { FilterBar } from "../components/Filters";
import { InsightCard, PriorityPanel } from "../components/Insights";
import { WeakTopicHeatmap } from "../charts";
import { TopicDetail } from "../components/TopicDetail";
export default function WeakAreas() {
  const { data, setEditor } = useData(),
    [filters, setFilters] = useState(emptyFilters),
    [topicId, setTopicId] = useState<string | null>(null);
  const stats = useMemo(
    () =>
      subjectStats(data, filters.from, filters.to).filter(
        (s) => !filters.subjectId || s.subject.id === filters.subjectId,
      ),
    [data, filters],
  );
  const priorities = useMemo(
    () => insights(data, filters.from, filters.to),
    [data, filters],
  );
  const topics = useMemo(
    () =>
      topicStats(data, filters.from, filters.to)
        .filter(
          (t) =>
            (!filters.subjectId || t.topic.subjectId === filters.subjectId) &&
            (t.overdue > 0 ||
              (t.attempted >= data.settings.minimumSample &&
                t.accuracy !== null &&
                t.accuracy < data.settings.strengthThreshold)),
        )
        .sort(
          (a, b) =>
            b.overdue - a.overdue || (a.accuracy || 100) - (b.accuracy || 100),
        )
        .slice(0, 15),
    [data, filters],
  );
  const totalHours = aggregate(data, filters.from, filters.to).hours;
  const highPerformance = (s: (typeof stats)[number]) =>
    s.health !== null && s.health >= data.settings.strengthThreshold;
  return (
    <>
      <PageHeader
        eyebrow="PRIORITIZE WITH EVIDENCE"
        title="Weak areas & knowledge health"
        description="Coverage, recall, practice, and tests work together. Study time alone never determines strength or weakness."
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="health-grid">
        {stats.map((s) => (
          <section className="card health-card" key={s.subject.id}>
            <div className="card-heading">
              <h2>{s.subject.name}</h2>
              <Badge tone={statusTone(s.status)}>
                <StatusIcon status={s.status} />
                {s.status}
              </Badge>
            </div>
            <ProgressBar
              value={s.coverage || 0}
              label="Coverage"
              detail={number(s.coverage, "%")}
            />
            <ProgressBar
              value={s.revisionCompletion || 0}
              label="Revision"
              detail={number(s.revisionCompletion, "%")}
              color="purple"
            />
            <ProgressBar
              value={s.accuracy || 0}
              label="MCQ accuracy"
              detail={
                s.attempted >= data.settings.minimumSample
                  ? number(s.accuracy, "%")
                  : `${s.attempted} questions · more data needed`
              }
              color="green"
            />
            <div className="small muted" style={{ marginBottom: 8 }}>
              Study allocation:{" "}
              {totalHours ? Math.round((s.hours / totalHours) * 100) : 0}%
              actual · {s.subject.targetAllocation}% subject target
            </div>
            <div className="small muted">
              {s.tests} tests · {s.answers} answers · {s.overdue} overdue
              revisions
            </div>
          </section>
        ))}
      </div>
      <ChartCard
        title="Weakness indicator matrix"
        description={`A weak label needs at least two measured indicators below ${data.settings.weaknessThreshold}%. Strong labels require most measured indicators at or above ${data.settings.strengthThreshold}%. MCQ accuracy requires ${data.settings.minimumSample} attempted questions.`}
      >
        <WeakTopicHeatmap data={data} filters={filters} />
      </ChartCard>
      <section className="card priority-matrix">
        <div className="card-heading">
          <h2>Your priority matrix</h2>
          <span className="small muted">
            Importance is user configured · performance uses multiple indicators
          </span>
        </div>
        <div className="quadrant-grid">
          {[
            {
              title: "Prioritize",
              sub: "High importance · lower performance",
              importance: true,
              performance: false,
              tone: "red",
            },
            {
              title: "Maintain",
              sub: "High importance · healthy performance",
              importance: true,
              performance: true,
              tone: "green",
            },
            {
              title: "Monitor",
              sub: "Lower importance · lower performance",
              importance: false,
              performance: false,
              tone: "amber",
            },
            {
              title: "Avoid over-allocation",
              sub: "Lower importance · healthy performance",
              importance: false,
              performance: true,
              tone: "blue",
            },
          ].map((q) => (
            <div className={`quadrant ${q.tone}`} key={q.title}>
              <h3>{q.title}</h3>
              <p>{q.sub}</p>
              {stats
                .filter(
                  (s) =>
                    s.health !== null &&
                    s.subject.priority >= 4 === q.importance &&
                    highPerformance(s) === q.performance,
                )
                .map((s) => (
                  <button
                    className="subject-chip"
                    key={s.subject.id}
                    onClick={() =>
                      setEditor({ collection: "subjects", record: s.subject })
                    }
                  >
                    {s.subject.name}
                    <span>
                      {s.health}% · priority {s.subject.priority}/5
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
        <p className="chart-note">
          Subjects with insufficient indicators are omitted. Select a subject to
          change its importance.
        </p>
      </section>
      <section className="card">
        <div className="card-heading">
          <h2>Topics that need a closer look</h2>
        </div>
        {topics.length ? (
          <div className="weak-topic-list">
            {topics.map((t) => (
              <button key={t.topic.id} onClick={() => setTopicId(t.topic.id)}>
                <div>
                  <strong>{t.topic.name}</strong>
                  <span>{t.subject.name}</span>
                </div>
                <Badge tone="amber">
                  {number(t.accuracy, "%")} accuracy · {t.overdue} overdue
                </Badge>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No topic gaps identified yet."
            text="Record enough topic-level practice or schedule revisions to build this view."
          />
        )}
      </section>
      <PriorityPanel items={priorities} />
      {priorities
        .filter((i) => i.kind === "improving")
        .slice(0, 3)
        .map((i) => (
          <InsightCard key={i.id} insight={i} />
        ))}
      {topicId && <TopicDetail id={topicId} onClose={() => setTopicId(null)} />}
    </>
  );
}
