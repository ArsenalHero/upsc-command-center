import { useMemo, useState } from "react";
import {
  Clock3,
  Target,
  CheckCircle2,
  BookOpen,
  Plus,
  Flame,
  Sparkles,
  CalendarDays,
  ChevronRight,
  RotateCcw,
  PenLine,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../hooks/useData";
import {
  aggregate,
  emptyFilters,
  getStreak,
  insights,
} from "../utils/analytics";
import {
  dateKey,
  addDays,
  weekStart,
  monthStart,
  number,
  prettyDate,
} from "../utils/date";
import {
  DashboardCard,
  ProgressBar,
  ProgressRing,
  ChartCard,
  PageHeader,
  TrendBadge,
  EmptyState,
  Badge,
  Help,
} from "../components/ui";
import { DateRangeSelector, SubjectFilter } from "../components/Filters";
import { PriorityPanel, InsightCard } from "../components/Insights";
import { StudyDetails } from "../components/StudyDetails";
import { ExamCountdowns } from "../components/ExamCountdowns";
import { selectedExam, workspaceExamLabel } from "../utils/examSettings";
import {
  StudyHoursChart,
  SubjectDistribution,
  StudyHeatmap,
  StageDonut,
  BalanceChart,
  SubjectRadar,
  WeakTopicHeatmap,
  TestPerformance,
  AccuracyChart,
} from "../charts";
export default function Dashboard() {
  const { data, setEditor, loadDemo } = useData();
  const [filters, setFilters] = useState(emptyFilters),
    [radarId, setRadarId] = useState(
      data.subjects.find((s) => s.name.includes("Polity"))?.id ||
        data.subjects[0]?.id ||
        "",
    ),
    [day, setDay] = useState<string | null>(null);
  const today = dateKey();
  const a = useMemo(
    () => aggregate(data, filters.from, filters.to, "", filters),
    [data, filters],
  );
  const daily = useMemo(() => aggregate(data, today, today), [data, today]);
  const weekly = useMemo(
    () => aggregate(data, weekStart(), today),
    [data, today],
  );
  const monthly = useMemo(
    () => aggregate(data, monthStart(), today),
    [data, today],
  );
  const before = useMemo(
    () => aggregate(data, addDays(weekStart(), -7), addDays(today, -7)),
    [data, today],
  );
  const priorities = useMemo(
    () => insights(data, filters.from, filters.to),
    [data, filters],
  );
  const dailyPct = (daily.hours / data.settings.dailyHours) * 100;
  const next = data.revisions
    .filter((r) => !r.completedDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const hasData = data.sessions.length || data.mcqs.length || data.tests.length || data.pyqs.some((p) => p.attempt);
  return (
    <>
      <PageHeader
        eyebrow="YOUR PREPARATION, AT A GLANCE"
        title={selectedExam(data.settings) === "State PSC" ? "State PSC overview" : "Your preparation"}
        description={`${prettyDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Target ${workspaceExamLabel(data.settings)}`}
        action={
          <button
            className="btn primary"
            onClick={() => setEditor({ collection: "sessions" })}
          >
            <Plus size={17} />
            Log study session
          </button>
        }
      />
      <ExamCountdowns settings={data.settings} />
      <div className="dashboard-control">
        <div className="view-tabs">
          <span className="selected">Overview</span>
          <Link to="/reports">Performance reports</Link>
        </div>
        <DateRangeSelector filters={filters} onChange={setFilters} />
      </div>
      <div className="stats-grid four">
        <DashboardCard
          title="Today's study"
          value={
            <>
              {number(daily.hours)}
              <small> / {data.settings.dailyHours}h</small>
            </>
          }
          icon={<Clock3 size={19} />}
          detail={
            <>
              <span className="positive">
                {Math.round(dailyPct)}% of daily target
              </span>
              <span className="muted">{daily.sessions.length} sessions</span>
            </>
          }
        >
          <ProgressBar value={dailyPct} />
        </DashboardCard>
        <DashboardCard
          title="This week's study"
          value={
            <>
              {number(weekly.hours)}
              <small> hours</small>
            </>
          }
          icon={<CalendarDays size={19} />}
          tone="purple"
          detail={
            <>
              <TrendBadge
                current={weekly.hours}
                previous={before.sessions.length ? before.hours : null}
                unit="h"
              />
              <span className="muted">vs last week</span>
            </>
          }
        >
          <ProgressBar
            value={(weekly.hours / data.settings.weeklyHours) * 100}
            color="purple"
          />
        </DashboardCard>
        <DashboardCard
          title="MCQ accuracy"
          value={
            <>
              {number(a.accuracy)}
              <small>%</small>
            </>
          }
          icon={<Target size={19} />}
          tone="green"
          detail={
            <>
              <span>
                {a.correct.toLocaleString()} / {a.attempted.toLocaleString()}{" "}
                correct
              </span>
              <span className="muted">selected period</span>
            </>
          }
        >
          <ProgressBar value={a.accuracy || 0} color="green" />
        </DashboardCard>
        <DashboardCard
          title="Syllabus progress"
          value={
            <>
              {number(a.coverage)}
              <small>%</small>
            </>
          }
          icon={<BookOpen size={19} />}
          tone="amber"
          detail={
            <>
              <span>
                {
                  data.topics.filter(
                    (t) => t.status === "Completed" || t.status === "Mastered",
                  ).length
                }{" "}
                topics completed
              </span>
              <Link to="/syllabus">View syllabus</Link>
            </>
          }
        >
          <ProgressBar value={a.coverage || 0} color="amber" />
        </DashboardCard>
      </div>
      <div className="micro-metrics">
        {[
          {
            label: "Daily target",
            value: `${Math.round(dailyPct)}%`,
            icon: Target,
          },
          {
            label: "Monthly hours",
            value: number(monthly.hours, "h"),
            icon: Clock3,
          },
          { label: "Answers written", value: a.answers, icon: PenLine },
          {
            label: "Revision health",
            value: number(a.revisionHealth, "%"),
            icon: RotateCcw,
          },
          {
            label: "Productivity",
            value: number(a.productivity, "%"),
            icon: Sparkles,
          },
          {
            label: "Study streak",
            value: `${getStreak(data)} days`,
            icon: Flame,
          },
        ].map((m) => (
          <div key={m.label}>
            <m.icon size={15} />
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>
      {priorities.find((i) => i.kind !== "improving") && (
        <div className="focus-strip">
          <Sparkles size={20} />
          <div>
            <div className="eyebrow">YOUR NEXT FOCUS</div>
            <h3>{priorities[0].title}</h3>
            <p>{priorities[0].observation}</p>
          </div>
          <Link to="/weak-areas">View priorities</Link>
        </div>
      )}
      {!hasData ? (
        <section className="card welcome-empty">
          <EmptyState onAction={() => setEditor({ collection: "sessions" })} />
          <button className="btn secondary" onClick={loadDemo}>
            Explore with demo data
          </button>
        </section>
      ) : (
        <>
          <div className="dashboard-main">
            <ChartCard
              title="Study hours trend"
              description="Recorded hours by date. Planned hours are summed from session plans; actual hours are summed from your entries."
              action={<Badge tone="blue">{number(a.hours, "h")} total</Badge>}
            >
              <StudyHoursChart data={data} filters={filters} />
            </ChartCard>
            <ChartCard
              title="Where your time goes"
              description="Study hours by subject in the selected period. Top six subjects. Time measures activity, not subject strength."
            >
              <SubjectDistribution data={data} filters={filters} limit={6} />
            </ChartCard>
          </div>
          <div className="dashboard-mid">
            <ChartCard
              title="Your study rhythm"
              description="Each square is one day. Intensity represents the chosen metric. Select a square to see that day's sessions."
              className="heatmap-card"
            >
              <StudyHeatmap data={data} onDay={setDay} />
            </ChartCard>
            <section className="card next-revision">
              <div className="card-heading">
                <h2>Next revision</h2>
                <RotateCcw size={18} />
              </div>
              {next ? (
                <>
                  <Badge tone={next.dueDate < today ? "red" : "amber"}>
                    {next.dueDate < today
                      ? "Overdue"
                      : next.dueDate === today
                        ? "Due today"
                        : "Upcoming"}
                  </Badge>
                  <h3>
                    {data.topics.find((t) => t.id === next.topicId)?.name}
                  </h3>
                  <p>
                    {data.subjects.find((s) => s.id === next.subjectId)?.name} ·{" "}
                    {next.stage}
                  </p>
                  <div className="revision-date">
                    <CalendarDays size={15} />
                    {prettyDate(next.dueDate)}
                  </div>
                  <Link className="btn secondary" to="/revision">
                    Open revision planner
                  </Link>
                </>
              ) : (
                <p className="muted">
                  Schedule a revision from any study session.
                </p>
              )}
            </section>
          </div>
          <PriorityPanel items={priorities} limit={3} />
          <div className="chart-grid three">
            <ChartCard
              title="Prelims & Mains balance"
              description="Share of recorded hours by session stage. Both stays separate to avoid guessing how shared study time was split."
            >
              <StageDonut data={data} filters={filters} />
            </ChartCard>
            <ChartCard
              title="Study balance"
              description="Actual share of study time versus your configured allocation targets. Each session belongs to one category."
            >
              <BalanceChart data={data} filters={filters} />
            </ChartCard>
            <ChartCard
              title="Subject strength"
              description="Six indicators, all scaled to percentages. PYQs are measured against your monthly target."
              action={
                <SubjectFilter
                  value={radarId}
                  onChange={(v) => setRadarId(v || data.subjects[0]?.id || "")}
                />
              }
            >
              <SubjectRadar data={data} filters={filters} subjectId={radarId} />
            </ChartCard>
          </div>
          <ChartCard
            title="Knowledge health matrix"
            description="Combines coverage, revision, MCQs, PYQs, tests, answers, and recency. Weakness needs multiple low indicators. Thresholds and minimum MCQ samples can be changed in Settings."
          >
            <WeakTopicHeatmap data={data} filters={filters} />
          </ChartCard>
          <div className="chart-grid two">
            <ChartCard
              title="Test performance"
              description="Each test's score as a percentage of its own maximum marks, with attempted-question accuracy shown separately."
            >
              <TestPerformance data={data} filters={filters} />
            </ChartCard>
            <ChartCard
              title="Accuracy over time"
              description="Correct answers divided by attempted MCQs for each date with recorded questions."
            >
              <AccuracyChart data={data} filters={filters} />
            </ChartCard>
          </div>
          <section className="card productivity-explanation">
            <div>
              <h2>How your productivity is calculated</h2>
              <p>
                Only measured components contribute. Available weights are
                normalized; every component is capped at 100%.
              </p>
            </div>
            <div className="productivity-parts">
              {a.productivityParts.map((p) => (
                <div key={p.key}>
                  <span>{p.label}</span>
                  <strong>
                    {p.value}%<small> · weight {p.weight}</small>
                  </strong>
                </div>
              ))}
            </div>
            <div className="small muted">
              Score = Σ(component × weight) / Σ(available weights).{" "}
              <Link to="/settings">Configure weights</Link>
            </div>
          </section>
        </>
      )}
      {day && <StudyDetails date={day} onClose={() => setDay(null)} />}
    </>
  );
}
