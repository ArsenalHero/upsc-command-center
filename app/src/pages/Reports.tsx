import { useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "../hooks/useData";
import { workspaceExamLabel } from "../utils/examSettings";
import {
  aggregate,
  emptyFilters,
  insights,
  subjectStats,
  goalValue,
  coverage,
} from "../utils/analytics";
import {
  dateKey,
  addDays,
  monthsAgo,
  monthEnd,
  periodBounds,
  daysBetween,
  prettyDate,
  number,
  round,
} from "../utils/date";
import {
  PageHeader,
  DashboardCard,
  ChartCard,
  TrendBadge,
  ProgressBar,
  Badge,
  EmptyState,
} from "../components/ui";
import { PriorityPanel, InsightCard } from "../components/Insights";
import {
  StudyHoursChart,
  SubjectDistribution,
  StageDonut,
  AccuracyChart,
  BalanceChart,
  SimpleBars,
  SimpleTrend,
} from "../charts";
import { download } from "../services/export";
function bounds(period: string, anchor: string): [string, string] {
  return period === "Quarterly"
    ? [monthsAgo(anchor, 2), monthEnd(anchor)]
    : periodBounds(period, anchor);
}
function previousBounds(period: string, start: string): [string, string] {
  if (period === "Daily") return [addDays(start, -1), addDays(start, -1)];
  if (period === "Weekly") return [addDays(start, -7), addDays(start, -1)];
  if (period === "Monthly")
    return [monthsAgo(start, 1), monthEnd(monthsAgo(start, 1))];
  if (period === "Quarterly")
    return [monthsAgo(start, 3), monthEnd(monthsAgo(start, 1))];
  return [
    `${Number(start.slice(0, 4)) - 1}-01-01`,
    `${Number(start.slice(0, 4)) - 1}-12-31`,
  ];
}
export default function Reports() {
  const { data, setEditor } = useData(),
    [period, setPeriod] = useState("Monthly"),
    [anchor, setAnchor] = useState(dateKey),
    [comparable, setComparable] = useState(true);
  const [from, end] = bounds(period, anchor),
    to = end > dateKey() ? dateKey() : end;
  const [prevFrom, prevEnd] = previousBounds(period, from),
    previousTo = comparable
      ? [
          prevEnd,
          addDays(prevFrom, Math.max(0, daysBetween(from, to))),
        ].sort()[0]
      : prevEnd;
  const a = useMemo(() => aggregate(data, from, to), [data, from, to]),
    b = useMemo(
      () => aggregate(data, prevFrom, previousTo),
      [data, prevFrom, previousTo],
    );
  const filters = { ...emptyFilters(), from, to };
  const priorities = useMemo(() => insights(data, from, to), [data, from, to]),
    stats = useMemo(() => subjectStats(data, from, to), [data, from, to]);
  const strongest = stats.filter((s) => s.status === "Strong"),
    weak = stats.filter((s) => s.status === "Weak");
  const improving = priorities.filter((i) => i.kind === "improving");
  const most = stats
      .filter((s) => s.hours > 0)
      .sort((a, b) => b.hours - a.hours)[0],
    neglected = stats
      .filter((s) => s.hours === 0 && s.subject.priority >= 3)
      .sort((a, b) => b.subject.priority - a.subject.priority)[0];
  const metrics = [
    { key: "hours", label: "Study hours", unit: "h", percent: false },
    { key: "attempted", label: "MCQs attempted", unit: "", percent: false },
    { key: "answers", label: "Answers written", unit: "", percent: false },
    { key: "tests", label: "Tests", unit: "", percent: false },
    {
      key: "revisions",
      label: "Revisions completed",
      unit: "",
      percent: false,
    },
    { key: "accuracy", label: "MCQ accuracy", unit: "%", percent: true },
    {
      key: "revisionHealth",
      label: "On-time revision",
      unit: "%",
      percent: true,
    },
    { key: "productivity", label: "Productivity", unit: "%", percent: true },
    { key: "pyqs", label: "PYQs", unit: "", percent: false },
    { key: "essays", label: "Essays", unit: "", percent: false },
    {
      key: "optionalHours",
      label: "Optional hours",
      unit: "h",
      percent: false,
    },
    { key: "csatHours", label: "CSAT hours", unit: "h", percent: false },
    { key: "coverage", label: "Syllabus coverage", unit: "%", percent: true },
    { key: "focus", label: "Average focus", unit: "/10", percent: false },
    {
      key: "distraction",
      label: "Distraction minutes",
      unit: " min",
      percent: false,
    },
  ] as const;
  const deltaItems = metrics
    .filter((m) => m.percent)
    .map((m) => ({
      name: m.label,
      delta:
        a[m.key] !== null && b[m.key] !== null
          ? Number(a[m.key]) - Number(b[m.key])
          : null,
    }))
    .filter((m): m is typeof m & { delta: number } => m.delta !== null)
    .sort((a, b) => b.delta - a.delta);
  const firstDelta = deltaItems[0];
  const largestImprovement =
    firstDelta && firstDelta.delta >= data.settings.trendThreshold
      ? firstDelta
      : null;
  const largestDecline =
    deltaItems.at(-1) &&
    deltaItems.at(-1)!.delta <= -data.settings.trendThreshold
      ? deltaItems.at(-1)
      : null;
  const months = useMemo(
    () =>
      [2, 1, 0].map((n) => {
        const start = monthsAgo(anchor, n),
          end = monthEnd(start),
          stop = end > dateKey() ? dateKey() : end;
        return {
          name: prettyDate(start, { month: "long" }),
          start,
          end: stop,
          partial: end > dateKey(),
          ...aggregate(data, start, stop),
        };
      }),
    [data, anchor],
  );
  const exportReport = () => {
    const text = [
      `UPSC ${period} report`,
      `${from} to ${to}`,
      `Comparison: ${prevFrom} to ${previousTo}`,
      `Target exam: ${workspaceExamLabel(data.settings)}`,
      "",
      ...metrics.map(
        (m) =>
          `${m.label}: ${number(a[m.key], m.unit)} (previous ${number(b[m.key], m.unit)})`,
      ),
      "",
      ...priorities
        .slice(0, 5)
        .flatMap((i, n) => [
          `${n + 1}. ${i.title}`,
          `Observation: ${i.observation}`,
          `Evidence: ${i.evidence}`,
          `Why: ${i.why}`,
          `Action: ${i.action}`,
          `Target: ${i.target}`,
        ]),
    ].join("\n");
    download(
      text,
      `upsc-${period.toLowerCase()}-report-${anchor}.txt`,
      "text/plain",
    );
  };
  const hasData =
    a.sessions.length || a.attempted || a.answers || a.tests || a.essays;
  return (
    <>
      <PageHeader
        eyebrow="SEE THE BIGGER PICTURE"
        title="Preparation reports"
        description="Review what improved, what slipped, and what deserves your next study block."
        action={
          <button className="btn secondary" onClick={exportReport}>
            <Download size={16} />
            Download report
          </button>
        }
      />
      <section className="report-controls" aria-label="Report controls">
        <div className="reports-toolbar">
          <div className="tabs" role="tablist" aria-label="Report period">
            {["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"].map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={p === period}
                className={period === p ? "active" : ""}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="report-date">
            Period containing
            <input
              type="date"
              aria-label="Report period date"
              value={anchor}
              max={dateKey()}
              onChange={(e) => {
                if (e.target.value) setAnchor(e.target.value);
              }}
            />
          </label>
        </div>
        <div className="report-period-line">
          <span>
            <CalendarDays size={16} />
            {prettyDate(from)}–
            {prettyDate(to, { day: "numeric", month: "short", year: "numeric" })}
            {period === "Quarterly" && " · rolling 3 months"}
          </span>
          <label className="check-label">
            <input
              type="checkbox"
              checked={comparable}
              onChange={(e) => setComparable(e.target.checked)}
            />
            Compare equal elapsed days
          </label>
        </div>
      </section>
      {end > dateKey() && (
        <div className="info-banner">
          <strong>Partial period</strong> · Current data runs through{" "}
          {prettyDate(dateKey())}. The comparison runs {prettyDate(prevFrom)}–
          {prettyDate(previousTo)}
          {comparable ? " to compare the same number of elapsed days." : "."}
        </div>
      )}
      {!hasData ? (
        <section className="card">
          <EmptyState
            title="No preparation records in this period."
            text="Choose a period with data or add your first study session."
            onAction={() => setEditor({ collection: "sessions" })}
          />
        </section>
      ) : (
        <>
          <div className="stats-grid four">
            <DashboardCard
              title="Study hours"
              value={number(a.hours, "h")}
              detail={
                <TrendBadge
                  current={a.hours}
                  previous={b.sessions.length ? b.hours : null}
                  unit="h"
                  threshold={(b.hours * data.settings.trendThreshold) / 100}
                />
              }
            />
            <DashboardCard
              title="MCQ accuracy"
              value={number(a.accuracy, "%")}
              detail={
                <TrendBadge
                  current={a.accuracy}
                  previous={b.accuracy}
                  threshold={data.settings.trendThreshold}
                  percentage
                />
              }
            />
            <DashboardCard
              title="Revision health"
              value={number(a.revisionHealth, "%")}
              detail={
                <TrendBadge
                  current={a.revisionHealth}
                  previous={b.revisionHealth}
                  threshold={data.settings.trendThreshold}
                  percentage
                />
              }
            />
            <DashboardCard
              title="Average study day"
              value={number(a.averageHours, "h")}
              detail={`${a.studyDays} active study days`}
            />
          </div>
          <section className="card report-summary">
            <div className="card-heading">
              <h2>Your {period.toLowerCase()} in focus</h2>
              <Badge tone="blue">From your recorded data</Badge>
            </div>
            <div className="summary-grid">
              <div>
                <h3>
                  <CheckCircle2 size={17} />
                  What went well
                </h3>
                <p>
                  {largestImprovement
                    ? `${largestImprovement.name} increased by ${round(largestImprovement.delta)} percentage points versus the comparison period.`
                    : strongest.length
                      ? `${strongest.map((s) => s.subject.name).join(", ")} meet your configured strength indicators.`
                      : `You logged ${a.hours} hours across ${a.studyDays} study days, ${a.attempted} MCQs, and ${a.answers} answers.`}
                </p>
              </div>
              <div>
                <h3>
                  <AlertTriangle size={17} />
                  What needs attention
                </h3>
                <p>
                  {largestDecline
                    ? `${largestDecline.name} decreased by ${round(Math.abs(largestDecline.delta))} percentage points.`
                    : a.overdue
                      ? `${a.overdue} revisions due in this period remain incomplete.`
                      : weak.length
                        ? `${weak.map((s) => s.subject.name).join(", ")} have multiple indicators below your thresholds.`
                        : "There is not yet enough evidence for a sustained decline. Keep recording practice and revisions."}
                </p>
              </div>
              <div>
                <h3>
                  <Target size={17} />
                  {period === "Daily"
                    ? "Tomorrow's priorities"
                    : "Next-period priorities"}
                </h3>
                <p>
                  {priorities.find((i) => i.kind !== "improving")?.action ||
                    "Maintain regular logging, complete scheduled revisions, and review your practice errors."}
                </p>
              </div>
            </div>
            <div className="summary-facts">
              <span>
                Most studied{" "}
                <strong>{most?.subject.name || "No sessions"}</strong>
              </span>
              <span>
                Activity gap{" "}
                <strong>
                  {neglected?.subject.name || "No high-priority gaps"}
                </strong>
              </span>
              <span>
                Improving areas <strong>{improving.length}</strong>
              </span>
              <span>
                Weak areas <strong>{weak.length}</strong>
              </span>
            </div>
          </section>
          <div className="chart-grid two">
            <ChartCard
              title="Study hours trend"
              description="Recorded and planned hours across the report period."
            >
              <StudyHoursChart data={data} filters={filters} />
            </ChartCard>
            <ChartCard
              title="Subject distribution"
              description="Recorded study time by subject. Hours show activity, not subject strength."
            >
              <SubjectDistribution data={data} filters={filters} />
            </ChartCard>
            <ChartCard
              title="Prelims & Mains balance"
              description="Share of time by stage. Both remains a separate category."
            >
              <StageDonut data={data} filters={filters} />
            </ChartCard>
            <ChartCard
              title="Study allocation"
              description="Actual share of study time versus your target category allocation."
            >
              <BalanceChart data={data} filters={filters} />
            </ChartCard>
          </div>
          <section className="card">
            <div className="card-heading">
              <h2>Current vs previous {period.toLowerCase()}</h2>
              <span className="small muted">
                Actual numerical changes · pp = percentage points
              </span>
            </div>
            <table className="record-table comparison-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Previous</th>
                  <th>Current</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.key}>
                    <td data-label="Metric">{m.label}</td>
                    <td data-label="Previous">{number(b[m.key], m.unit)}</td>
                    <td data-label="Current">{number(a[m.key], m.unit)}</td>
                    <td data-label="Change">
                      <TrendBadge
                        current={a[m.key]}
                        previous={b[m.key]}
                        unit={m.unit}
                        percentage={m.percent}
                        threshold={
                          m.percent
                            ? data.settings.trendThreshold
                            : (Math.abs(Number(b[m.key])) *
                                data.settings.trendThreshold) /
                              100
                        }
                      />
                      {!m.percent &&
                        b[m.key] !== null &&
                        Number(b[m.key]) > 0 && (
                          <small className="muted">
                            {round(
                              ((Number(a[m.key]) - Number(b[m.key])) /
                                Number(b[m.key])) *
                                100,
                            )}
                            % relative
                          </small>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {(period === "Monthly" || period === "Quarterly") && (
            <>
              <div className="section-heading">
                <h2>Month-to-month comparison</h2>
                <span className="small muted">
                  Each chart uses its own scale
                </span>
              </div>
              <div className="chart-grid two">
                {metrics.slice(0, 5).map((m) => (
                  <ChartCard
                    key={m.key}
                    title={m.label}
                    description={`${m.label} in the current and comparison periods. The chart only contains this metric to avoid mixing incompatible units.`}
                  >
                    <SimpleBars
                      rows={[
                        {
                          name: m.label,
                          previous: b[m.key],
                          current: a[m.key],
                        },
                      ]}
                      series={[
                        { key: "previous", name: "Previous", color: "#a8b1c7" },
                        { key: "current", name: "Current", color: "#3158eb" },
                      ]}
                      unit={m.unit}
                    />
                  </ChartCard>
                ))}
              </div>
            </>
          )}
          {period === "Quarterly" && (
            <>
              <div className="section-heading">
                <h2>Three-month preparation trend</h2>
                <span className="small muted">
                  Minor changes below your threshold are marked stable
                </span>
              </div>
              <div className="quarter-cards">
                {months.map((m, i) => (
                  <section className="card quarter-card" key={m.start}>
                    <div className="card-heading">
                      <h2>{m.name}</h2>
                      {m.partial && <Badge tone="amber">Partial</Badge>}
                    </div>
                    {[
                      "hours",
                      "accuracy",
                      "attempted",
                      "answers",
                      "tests",
                      "revisionHealth",
                      "coverage",
                      "optionalHours",
                      "csatHours",
                    ].map((key) => {
                      const k = key as "hours",
                        old = i > 0 ? months[i - 1][k] : null;
                      return (
                        <div className="quarter-metric" key={key}>
                          <span>
                            {
                              (
                                {
                                  hours: "Hours",
                                  accuracy: "Accuracy %",
                                  attempted: "MCQs",
                                  answers: "Answers",
                                  tests: "Tests",
                                  revisionHealth: "Revision health %",
                                  coverage: "Syllabus %",
                                  optionalHours: "Optional hours",
                                  csatHours: "CSAT hours",
                                } as any
                              )[key]
                            }
                          </span>
                          <strong>{number(m[k])}</strong>
                          {i > 0 && (
                            <TrendBadge
                              current={m[k]}
                              previous={old}
                              threshold={
                                [
                                  "accuracy",
                                  "revisionHealth",
                                  "coverage",
                                ].includes(key)
                                  ? data.settings.trendThreshold
                                  : (Number(old) *
                                      data.settings.trendThreshold) /
                                    100
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
              <div className="chart-grid two">
                <ChartCard
                  title="Hours across three months"
                  description="Full calendar months, except the current month which is explicitly partial."
                >
                  <SimpleTrend
                    rows={months}
                    x="name"
                    series={[
                      { key: "hours", name: "Study hours", color: "#3158eb" },
                      {
                        key: "optionalHours",
                        name: "Optional hours",
                        color: "#865de5",
                      },
                      {
                        key: "csatHours",
                        name: "CSAT hours",
                        color: "#ed9e36",
                      },
                    ]}
                    unit="h"
                  />
                </ChartCard>
                <ChartCard
                  title="Preparation indicators"
                  description="Accuracy, productivity, revision health, and syllabus coverage on a common percentage scale."
                >
                  <SimpleTrend
                    rows={months}
                    x="name"
                    series={[
                      { key: "accuracy", name: "Accuracy", color: "#18a593" },
                      {
                        key: "productivity",
                        name: "Productivity",
                        color: "#3158eb",
                      },
                      {
                        key: "revisionHealth",
                        name: "Revision health",
                        color: "#865de5",
                      },
                      { key: "coverage", name: "Syllabus", color: "#ed9e36" },
                    ]}
                    unit="%"
                  />
                </ChartCard>
                <ChartCard
                  title="Practice across three months"
                  description="Counts of answers, tests, and completed revisions; all series are record counts."
                >
                  <SimpleBars
                    rows={months}
                    series={[
                      { key: "answers", name: "Answers", color: "#865de5" },
                      { key: "tests", name: "Tests", color: "#3158eb" },
                      { key: "revisions", name: "Revisions", color: "#18a593" },
                    ]}
                  />
                </ChartCard>
                <section className="card">
                  <div className="card-heading">
                    <h2>Sustained trends</h2>
                  </div>
                  <div className="trend-analysis">
                    {[
                      "accuracy",
                      "revisionHealth",
                      "productivity",
                      "coverage",
                    ].map((key) => {
                      const vals = months.map(
                        (m) => (m as any)[key] as number | null,
                      );
                      const change1 =
                          vals[0] !== null && vals[1] !== null
                            ? vals[1] - vals[0]
                            : null,
                        change2 =
                          vals[1] !== null && vals[2] !== null
                            ? vals[2] - vals[1]
                            : null;
                      const comparableMonths = !months.some((m) => m.partial);
                      const status =
                        comparableMonths && change1 !== null && change2 !== null
                          ? change1 >= data.settings.trendThreshold &&
                            change2 >= data.settings.trendThreshold
                            ? "Sustained improvement"
                            : change1 <= -data.settings.trendThreshold &&
                                change2 <= -data.settings.trendThreshold
                              ? "Sustained decline"
                              : "Mixed or stable"
                          : "Continue measuring";
                      return (
                        <div key={key}>
                          <strong>
                            {key === "revisionHealth"
                              ? "Revision health"
                              : key.charAt(0).toUpperCase() + key.slice(1)}
                          </strong>
                          <Badge
                            tone={
                              status.includes("improvement")
                                ? "green"
                                : status.includes("decline")
                                  ? "red"
                                  : "neutral"
                            }
                          >
                            {status}
                          </Badge>
                          <p>
                            {vals.map((v) => number(v, "%")).join(" → ")}
                            {!comparableMonths
                              ? " · Current month is partial; no sustained trend is inferred."
                              : ` · Threshold: ${data.settings.trendThreshold} percentage points per month.`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </>
          )}
          <section className="card">
            <div className="card-heading">
              <h2>Goal progress</h2>
              <Link className="text-btn" to="/goals">
                Manage goals
              </Link>
            </div>
            <div className="report-goals">
              {data.goals.map((g) => {
                const v = goalValue(data, g, anchor);
                return (
                  <ProgressBar
                    key={g.id}
                    label={`${g.name} · ${g.period}`}
                    value={v.progress}
                    detail={`${number(v.value)} / ${g.target}`}
                  />
                );
              })}
            </div>
          </section>
          <PriorityPanel
            items={priorities}
            title={
              period === "Quarterly"
                ? "Top 5 data-backed priorities for next quarter"
                : period === "Weekly"
                  ? "Top 5 priorities for next week"
                  : "What should I focus on next?"
            }
            limit={5}
          />
          {improving.slice(0, 3).map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </>
      )}
    </>
  );
}
