import { useMemo, useState } from "react";
import {
  Plus,
  Target,
  PenLine,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Link2,
} from "lucide-react";
import type { Filters } from "../types";
import { useData } from "../hooks/useData";
import {
  aggregate,
  emptyFilters,
  insights,
  subjectStats,
  matches,
  errorSummary,
} from "../utils/analytics";
import { number, prettyDate, round, weekStart } from "../utils/date";
import {
  PageHeader,
  DashboardCard,
  ChartCard,
  ProgressBar,
  Badge,
  EmptyState,
  statusTone,
  TrendBadge,
} from "../components/ui";
import { FilterBar } from "../components/Filters";
import { RecordTable } from "../components/RecordTable";
import { PriorityPanel } from "../components/Insights";
import {
  AccuracyChart,
  TestPerformance,
  SimpleBars,
  SimpleTrend,
  AnswerScatter,
  ErrorDonut,
  WeakTopicHeatmap,
  SubjectRadar,
} from "../charts";
import { SyllabusTree } from "./Syllabus";
function useAnalytics(stage = "") {
  const { data } = useData();
  const [filters, setFilters] = useState<Filters>(() => ({
    ...emptyFilters(),
    stage,
  }));
  const a = useMemo(
    () => aggregate(data, filters.from, filters.to, "", filters),
    [data, filters],
  );
  return { filters, setFilters, a };
}
function AddButton({
  collection,
  label,
  preset,
}: {
  collection: import("../types").Collection;
  label: string;
  preset?: Record<string, unknown>;
}) {
  const { setEditor } = useData();
  return (
    <button
      className="btn primary"
      onClick={() => setEditor({ collection, preset })}
    >
      <Plus size={16} />
      {label}
    </button>
  );
}
export function Prelims() {
  const { data } = useData(),
    { filters, setFilters, a } = useAnalytics("Prelims");
  return (
    <>
      <PageHeader
        eyebrow="GENERAL STUDIES · PAPER I"
        title="Prelims preparation"
        description="Track question accuracy, test performance, and static syllabus coverage."
        action={
          <AddButton
            collection="mcqs"
            label="Log MCQ practice"
            preset={{ stage: "Prelims" }}
          />
        }
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="stats-grid four">
        <DashboardCard title="Questions attempted" value={a.attempted} />
        <DashboardCard
          title="MCQ accuracy"
          value={number(a.accuracy, "%")}
          detail={`${a.correct} correct · ${a.incorrect} incorrect`}
        />
        <DashboardCard
          title="Tests taken"
          value={a.tests}
          detail={`${number(a.testScore, "%")} average score`}
        />
        <DashboardCard title="PYQs practised" value={a.pyqs} />
      </div>
      <div className="chart-grid two">
        <ChartCard
          title="Accuracy trend"
          description="Percentage of attempted questions answered correctly on each practice date."
        >
          <AccuracyChart data={data} filters={filters} />
        </ChartCard>
        <ChartCard
          title="Test score & accuracy"
          description="Each score is divided by the test's maximum marks. No exam-outcome prediction is made."
        >
          <TestPerformance data={data} filters={filters} />
        </ChartCard>
      </div>
      <PriorityPanel
        items={insights(data, filters.from, filters.to).filter(
          (i) =>
            !i.subjectId ||
            data.subjects.find((s) => s.id === i.subjectId)?.stage !==
              "Optional",
        )}
      />
      <RecordTable
        collection="mcqs"
        records={data.mcqs.filter((m) => matches(m, filters))}
        columns={[
          { key: "date", label: "Date", render: (r) => prettyDate(r.date) },
          {
            key: "subjectId",
            label: "Subject",
            render: (r) =>
              data.subjects.find((s) => s.id === r.subjectId)?.name,
          },
          { key: "attempted", label: "Attempted" },
          { key: "correct", label: "Correct" },
          {
            key: "accuracy",
            label: "Accuracy",
            render: (r) =>
              r.attempted ? `${round((r.correct / r.attempted) * 100)}%` : "—",
          },
        ]}
      />
    </>
  );
}
export function Mains() {
  const { data } = useData(),
    { filters, setFilters, a } = useAnalytics("Mains");
  const rows = ["GS-I", "GS-II", "GS-III", "GS-IV"]
    .map((p) => {
      const answers = data.answers.filter(
        (x) =>
          x.paper === p && matches(x, { from: filters.from, to: filters.to }),
      );
      return {
        name: p,
        score: answers.length
          ? round(
              answers.reduce((n, x) => n + (x.score / x.marks) * 100, 0) /
                answers.length,
            )
          : null,
        answers: answers.length,
      };
    })
    .filter((r) => r.answers > 0);
  return (
    <>
      <PageHeader
        eyebrow="GENERAL STUDIES · PAPERS I–IV"
        title="Mains preparation"
        description="Develop recall, structure, examples, and timed answer writing."
        action={<AddButton collection="answers" label="Log Mains answer" />}
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="stats-grid four">
        <DashboardCard title="Answers written" value={a.answers} />
        <DashboardCard
          title="Average answer score"
          value={number(a.answerScore, "%")}
        />
        <DashboardCard
          title="Time per answer"
          value={number(a.answerMinutes, " min")}
        />
        <DashboardCard
          title="Ethics case studies"
          value={
            data.ethics.filter((e) =>
              matches(e, { from: filters.from, to: filters.to }),
            ).length
          }
        />
      </div>
      <div className="chart-grid two">
        <ChartCard
          title="GS-wise answer performance"
          description="Average awarded score as a percentage of each answer's maximum marks. Answers with different marks stay comparable."
        >
          <SimpleBars
            rows={rows}
            series={[
              { key: "score", name: "Average score %", color: "#865de5" },
            ]}
            unit="%"
          />
        </ChartCard>
        <ChartCard
          title="Time & answer quality"
          description="Each dot is one answer. Compare minutes taken with awarded score percentage; hover for exact values."
        >
          <AnswerScatter data={data} filters={{ ...filters, stage: "" }} />
        </ChartCard>
      </div>
      <div className="section-heading">
        <h2>Ethics case study tracker</h2>
        <AddButton collection="ethics" label="Add case study" />
      </div>
      <RecordTable
        collection="ethics"
        records={data.ethics.filter((e) =>
          matches(e, { from: filters.from, to: filters.to }),
        )}
        columns={[
          { key: "date", label: "Date", render: (r) => prettyDate(r.date) },
          { key: "caseStudy", label: "Case study" },
          { key: "minutes", label: "Minutes" },
          {
            key: "score",
            label: "Score",
            render: (r) => `${r.score}/${r.maximum}`,
          },
        ]}
        title="GS-IV case studies"
      />
    </>
  );
}
export function Optional() {
  const { data, setEditor, updateSettings, notify } = useData(),
    { filters, setFilters, a } = useAnalytics("Optional"),
    [optional, setOptional] = useState(data.settings.optional);
  const subjects = data.subjects.filter((s) => s.stage === "Optional");
  const optionalData = {
    ...data,
    subjects: data.subjects.filter((s) => s.stage === "Optional"),
    topics: data.topics.filter((t) =>
      subjects.some((s) => s.id === t.subjectId),
    ),
  };
  return (
    <>
      <PageHeader
        eyebrow="YOUR OPTIONAL, YOUR SYSTEM"
        title={`${data.settings.optional || "Optional"} preparation`}
        description="Organize Paper I and Paper II into units, topics, and subtopics of any depth."
        action={
          <AddButton
            collection="topics"
            label="Add Optional topic"
            preset={{ subjectId: subjects[0]?.id || "" }}
          />
        }
      />
      <section className="card optional-setup">
        <label>
          Optional subject
          <input
            list="optional-options"
            value={optional}
            onChange={(e) => setOptional(e.target.value)}
            placeholder="Select or enter a custom Optional"
          />
          <datalist id="optional-options">
            {[
              "Sociology",
              "Anthropology",
              "Political Science & International Relations",
              "Geography",
              "History",
              "Public Administration",
              "Philosophy",
              "Psychology",
              "Mathematics",
              "Economics",
              "Literature",
              "Law",
              "Agriculture",
            ].map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>
        <button
          className="btn primary"
          onClick={() => {
            if (
              optional.trim() &&
              updateSettings({ ...data.settings, optional: optional.trim() })
            )
              notify("Optional subject updated.");
          }}
        >
          Save Optional
        </button>
        <button
          className="btn secondary"
          onClick={() =>
            setEditor({
              collection: "subjects",
              preset: { stage: "Optional", paper: "Optional" },
            })
          }
        >
          <Plus size={16} />
          Add custom Optional subject
        </button>
      </section>
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="stats-grid four">
        <DashboardCard
          title="Optional hours"
          value={number(a.optionalHours, "h")}
        />
        <DashboardCard
          title="Weekly target"
          value={`${data.settings.optionalHours}h`}
        />
        <DashboardCard title="Questions practised" value={a.attempted} />
        <DashboardCard title="Answers written" value={a.answers} />
      </div>
      <div className="chart-grid two">
        <ChartCard
          title="Optional practice accuracy"
          description="Correct divided by attempted questions in Optional practice records."
        >
          <AccuracyChart data={data} filters={filters} />
        </ChartCard>
        <ChartCard
          title="Optional topic indicators"
          description="Coverage, revision, practice, and test indicators. Select a subject for its detailed view."
        >
          <SubjectRadar
            data={data}
            filters={filters}
            subjectId={subjects[0]?.id || ""}
          />
        </ChartCard>
      </div>
      {subjects.map((s) => (
        <section className="card syllabus-subject" key={s.id}>
          <div className="card-heading">
            <h2>{s.name} · syllabus</h2>
          </div>
          <SyllabusTree subjectId={s.id} />
        </section>
      ))}
    </>
  );
}
export function CSAT() {
  const { data } = useData(),
    { filters, setFilters, a } = useAnalytics("CSAT");
  const warning = insights(data, filters.from, filters.to).find(
    (i) => i.id === "csat-neglect",
  );
  const rows = data.topics
    .filter(
      (t) => data.subjects.find((s) => s.id === t.subjectId)?.stage === "CSAT",
    )
    .map((t) => {
      const mcqs = data.mcqs.filter(
        (m) =>
          m.topicId === t.id &&
          matches(m, { from: filters.from, to: filters.to }),
      );
      const total = mcqs.reduce((n, m) => n + m.attempted, 0);
      return {
        name: t.name,
        accuracy: total
          ? round((mcqs.reduce((n, m) => n + m.correct, 0) / total) * 100)
          : null,
        attempted: total,
      };
    })
    .filter((r) => r.attempted > 0);
  return (
    <>
      <PageHeader
        eyebrow="KEEP A SEPARATE PRACTICE RHYTHM"
        title="CSAT preparation"
        description="Quantitative aptitude, reasoning, comprehension, interpretation, and decision making."
        action={
          <AddButton
            collection="mcqs"
            label="Log CSAT practice"
            preset={{
              stage: "CSAT",
              subjectId:
                data.subjects.find((s) => s.stage === "CSAT")?.id || "",
            }}
          />
        }
      />
      {warning && (
        <div className="attention-banner">
          <AlertTriangle size={21} />
          <div>
            <strong>CSAT neglect warning</strong>
            <p>
              {warning.observation} {warning.action}
            </p>
          </div>
        </div>
      )}
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="stats-grid four">
        <DashboardCard
          title="Questions practised"
          value={a.attempted}
          detail={`${a.correct} correct · ${a.incorrect} incorrect`}
        />
        <DashboardCard title="Accuracy" value={number(a.accuracy, "%")} />
        <DashboardCard
          title="Study hours"
          value={number(a.csatHours, "h")}
          detail={`${data.settings.csatHours}h weekly target`}
        />
        <DashboardCard
          title="Practice minutes"
          value={a.mcqs.reduce((n, m) => n + m.minutes, 0)}
        />
      </div>
      <div className="chart-grid two">
        <ChartCard
          title="CSAT accuracy trend"
          description="Correct answers divided by attempted questions. This describes recorded practice and does not predict qualification."
        >
          <AccuracyChart data={data} filters={filters} />
        </ChartCard>
        <ChartCard
          title="Accuracy by CSAT topic"
          description="Practice accuracy by topic. Unpractised topics are omitted."
        >
          <SimpleBars
            rows={rows}
            series={[{ key: "accuracy", name: "Accuracy", color: "#ed9e36" }]}
            unit="%"
            horizontal
          />
        </ChartCard>
      </div>
      <RecordTable
        collection="mcqs"
        records={data.mcqs.filter((m) => matches(m, filters))}
        title="CSAT practice records"
        columns={[
          { key: "date", label: "Date", render: (r) => prettyDate(r.date) },
          {
            key: "topicId",
            label: "Topic",
            render: (r) =>
              data.topics.find((t) => t.id === r.topicId)?.name || "Unassigned",
          },
          { key: "attempted", label: "Questions" },
          {
            key: "difficulty",
            label: "Difficulty",
            render: (r) => `${r.difficulty}/5`,
          },
          { key: "minutes", label: "Minutes" },
          {
            key: "correct",
            label: "Correct / incorrect",
            render: (r) => `${r.correct} / ${r.incorrect}`,
          },
        ]}
      />
    </>
  );
}
export function CurrentAffairs() {
  const { data } = useData(),
    { filters, setFilters } = useAnalytics();
  const records = data.currentAffairs.filter((c) => matches(c, filters));
  const rows = data.subjects
    .map((s) => ({
      name: s.name,
      value: records.filter((c) => c.subjectId === s.id).length,
    }))
    .filter((r) => r.value > 0);
  return (
    <>
      <PageHeader
        eyebrow="CONNECT THE DYNAMIC WITH THE STATIC"
        title="Current affairs"
        description="Keep facts, analysis, syllabus connections, and revision in one place."
        action={
          <AddButton collection="currentAffairs" label="Add current affairs" />
        }
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="stats-grid four">
        <DashboardCard title="Issues recorded" value={records.length} />
        <DashboardCard
          title="Prelims relevant"
          value={records.filter((c) => c.prelims).length}
        />
        <DashboardCard
          title="Mains relevant"
          value={records.filter((c) => c.mains).length}
        />
        <DashboardCard
          title="Revision completed"
          value={
            records.length
              ? `${round((records.filter((c) => c.revised).length / records.length) * 100)}%`
              : "—"
          }
        />
      </div>
      <section className="card integration-flow">
        <h2>Build an integrated note</h2>
        <div className="flow-steps">
          {[
            "Current issue",
            "Static subject",
            "Prelims fact",
            "Mains analysis",
            "Revision",
          ].map((x, i) => (
            <div key={x}>
              <span>{i + 1}</span>
              <strong>{x}</strong>
            </div>
          ))}
        </div>
      </section>
      <ChartCard
        title="Issues by subject"
        description="Count of current affairs notes linked to each subject in this period."
      >
        <SimpleBars rows={rows} horizontal />
      </ChartCard>
      <RecordTable
        collection="currentAffairs"
        records={records}
        columns={[
          { key: "date", label: "Date", render: (r) => prettyDate(r.date) },
          { key: "title", label: "Issue" },
          { key: "source", label: "Source" },
          {
            key: "subjectId",
            label: "Static connection",
            render: (r) =>
              `${data.subjects.find((s) => s.id === r.subjectId)?.name || ""} · ${r.staticLink || "Not linked"}`,
          },
          {
            key: "revised",
            label: "Revision",
            render: (r) => (
              <Badge tone={r.revised ? "green" : "amber"}>
                {r.revised ? "Completed" : "Pending"}
              </Badge>
            ),
          },
        ]}
      />
    </>
  );
}
export function AnswerWriting() {
  const { data } = useData(),
    { filters, setFilters, a } = useAnalytics();
  const records = data.answers.filter((x) => matches(x, filters));
  const weeks = new Map<
    string,
    { name: string; answers: number; score: number; minutes: number }
  >();
  records.forEach((r) => {
    const w = weekStart(r.date),
      v = weeks.get(w) || { name: w, answers: 0, score: 0, minutes: 0 };
    v.answers++;
    v.score += (r.score / r.marks) * 100;
    v.minutes += r.minutes;
    weeks.set(w, v);
  });
  const rows = [...weeks.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => ({
      ...v,
      name: prettyDate(v.name),
      score: round(v.score / v.answers),
      minutes: round(v.minutes / v.answers),
    }));
  return (
    <>
      <PageHeader
        eyebrow="THINK CLEARLY. WRITE WITH PURPOSE."
        title="Answer writing"
        description="Track structure, evidence, quality, and time across the GS papers."
        action={<AddButton collection="answers" label="Log Mains answer" />}
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="stats-grid four">
        <DashboardCard title="Answers written" value={a.answers} />
        <DashboardCard
          title="Average score"
          value={number(a.answerScore, "%")}
        />
        <DashboardCard
          title="Time per answer"
          value={number(a.answerMinutes, " min")}
        />
        <DashboardCard
          title="Diagrams used"
          value={records.filter((r) => r.diagram).length}
        />
      </div>
      <div className="chart-grid two">
        <ChartCard
          title="Answers per week"
          description="Number of detailed answer records grouped by the week starting Monday."
        >
          <SimpleBars
            rows={rows}
            series={[{ key: "answers", name: "Answers", color: "#865de5" }]}
          />
        </ChartCard>
        <ChartCard
          title="Time versus score"
          description="Each dot is an answer. Hover to compare the time taken and awarded score percentage."
        >
          <AnswerScatter data={data} filters={filters} />
        </ChartCard>
        <ChartCard
          title="Average score by week"
          description="Each answer is normalized by its maximum marks before weekly averaging."
        >
          <SimpleTrend
            rows={rows}
            x="name"
            series={[{ key: "score", name: "Average score", color: "#865de5" }]}
            unit="%"
          />
        </ChartCard>
        <ChartCard
          title="Time per answer"
          description="Average writing time in minutes, grouped by week. Interpret alongside score."
        >
          <SimpleTrend
            rows={rows}
            x="name"
            series={[
              { key: "minutes", name: "Minutes per answer", color: "#18a593" },
            ]}
            unit=" min"
          />
        </ChartCard>
      </div>
      <RecordTable
        collection="answers"
        records={records}
        columns={[
          { key: "date", label: "Date", render: (r) => prettyDate(r.date) },
          { key: "paper", label: "Paper" },
          { key: "question", label: "Question" },
          { key: "minutes", label: "Minutes" },
          {
            key: "score",
            label: "Score",
            render: (r) => `${r.score}/${r.marks}`,
          },
        ]}
      />
    </>
  );
}
export function Essay() {
  const { data } = useData(),
    { filters, setFilters } = useAnalytics();
  const records = data.essays.filter((e) =>
    matches(e, { from: filters.from, to: filters.to }),
  );
  const rows = records
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({
      ...e,
      mentor: round((e.mentorScore / e.maximum) * 100),
      self: round((e.selfScore / e.maximum) * 100),
    }));
  return (
    <>
      <PageHeader
        eyebrow="ARGUMENT. PERSPECTIVE. CLARITY."
        title="Essay practice"
        description="Evaluate structure, multidimensionality, examples, and the quality of your conclusions."
        action={<AddButton collection="essays" label="Log essay" />}
      />
      <FilterBar filters={filters} onChange={setFilters} full={false} />
      <div className="stats-grid three">
        <DashboardCard title="Essays written" value={records.length} />
        <DashboardCard
          title="Average mentor score"
          value={
            rows.length
              ? `${round(rows.reduce((n, r) => n + r.mentor, 0) / rows.length)}%`
              : "—"
          }
        />
        <DashboardCard
          title="Monthly essay target"
          value={data.settings.essayTarget}
        />
      </div>
      <ChartCard
        title="Essay score trend"
        description="Mentor and self scores as percentages of each essay's maximum marks."
      >
        <SimpleTrend
          rows={rows}
          series={[
            { key: "mentor", name: "Mentor score %", color: "#865de5" },
            { key: "self", name: "Self score %", color: "#a8b1c7" },
          ]}
          unit="%"
        />
      </ChartCard>
      <RecordTable
        collection="essays"
        records={records}
        columns={[
          { key: "date", label: "Date", render: (r) => prettyDate(r.date) },
          { key: "topic", label: "Essay topic" },
          { key: "category", label: "Category" },
          { key: "words", label: "Words" },
          { key: "minutes", label: "Minutes" },
          {
            key: "mentorScore",
            label: "Mentor / self",
            render: (r) =>
              `${r.mentorScore} / ${r.selfScore} (max ${r.maximum})`,
          },
        ]}
      />
    </>
  );
}
export function MCQAnalysis() {
  const { data, setEditor } = useData(),
    { filters, setFilters, a } = useAnalytics();
  const records = data.mcqs.filter((m) => matches(m, filters));
  const seen = records.reduce((n, m) => n + m.seen, 0),
    conceptual = records.reduce((n, m) => n + (m.errors.Conceptual || 0), 0),
    revised = records.reduce((n, m) => n + m.revisedErrors, 0);
  const subjectRows = data.subjects
    .map((s) => ({
      name: s.name,
      value: records
        .filter((m) => m.subjectId === s.id)
        .reduce((n, m) => n + m.incorrect, 0),
    }))
    .filter((r) => r.value > 0);
  const topicRows = data.topics
    .map((t) => ({
      name: t.name,
      value: records
        .filter((m) => m.topicId === t.id)
        .reduce((n, m) => n + m.incorrect, 0),
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const trend = records
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, errors: m.incorrect }));
  return (
    <>
      <PageHeader
        eyebrow="TURN MISTAKES INTO A PLAN"
        title="MCQ analysis"
        description="Find where questions turn into errors, and whether those errors are being revised."
        action={<AddButton collection="mcqs" label="Log MCQ practice" />}
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="stats-grid four">
        <DashboardCard title="Questions attempted" value={a.attempted} />
        <DashboardCard title="Accuracy" value={number(a.accuracy, "%")} />
        <DashboardCard title="Conceptual errors" value={conceptual} />
        <DashboardCard title="Errors revised" value={revised} />
      </div>
      <section className="card funnel-card">
        <div className="card-heading">
          <h2>Your question-to-learning funnel</h2>
        </div>
        {records.length ? (
          <>
            <div className="funnel-top">
              <div>
                Questions seen<strong>{seen.toLocaleString()}</strong>
              </div>
              <div>
                Attempted<strong>{a.attempted.toLocaleString()}</strong>
              </div>
            </div>
            <div className="funnel-outcomes">
              <div className="correct">
                Correct<strong>{a.correct.toLocaleString()}</strong>
              </div>
              <div className="incorrect">
                Incorrect<strong>{a.incorrect.toLocaleString()}</strong>
                <div className="error-subsets">
                  <span>
                    Conceptual <strong>{conceptual}</strong>
                  </span>
                  <span>
                    Revised errors <strong>{revised}</strong>
                  </span>
                </div>
              </div>
            </div>
            <p className="chart-note">
              Correct and incorrect are parallel outcomes. Revised errors are a
              subset of incorrect answers; conceptual errors may also be
              revised.
            </p>
          </>
        ) : (
          <EmptyState
            title="No MCQ records yet."
            text="Log a scored question set to see the funnel."
            onAction={() => setEditor({ collection: "mcqs" })}
          />
        )}
      </section>
      <div className="chart-grid two">
        <ChartCard
          title="What causes your errors?"
          description="Primary error categories from your MCQ records. Unclassified wrong answers are omitted."
        >
          <ErrorDonut data={data} filters={filters} />
        </ChartCard>
        <ChartCard
          title="Errors by subject"
          description="Total incorrect answers by subject. Compare with attempted-question counts before judging performance."
        >
          <SimpleBars rows={subjectRows} horizontal />
        </ChartCard>
        <ChartCard
          title="Error trend"
          description="Incorrect answers in each question set. A larger set can produce more errors even if accuracy improves."
        >
          <SimpleTrend
            rows={trend}
            series={[{ key: "errors", name: "Incorrect", color: "#de667f" }]}
          />
        </ChartCard>
        <ChartCard
          title="Most repeated error topics"
          description="Topics with the most recorded incorrect answers in this period."
        >
          <SimpleBars rows={topicRows} horizontal />
        </ChartCard>
      </div>
      <RecordTable collection="mcqs" records={records} />
    </>
  );
}
export function PYQs() {
  const { data } = useData(),
    { filters, setFilters, a } = useAnalytics();
  const records = data.pyqs.filter((p) => matches(p, filters)),
    rows = data.topics
      .map((t) => ({
        name: t.name,
        value: records.filter((p) => p.topicId === t.id).length,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  return (
    <>
      <PageHeader
        eyebrow="LEARN FROM THE QUESTIONS"
        title="Previous year questions"
        description="Connect question themes, concept gaps, and targeted revision."
        action={<AddButton collection="pyqs" label="Add PYQ record" />}
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="stats-grid three">
        <DashboardCard title="PYQs practised" value={a.pyqs} />
        <DashboardCard title="Question records" value={records.length} />
        <DashboardCard
          title="Revision flagged"
          value={records.filter((p) => p.revisionNeeded).length}
        />
      </div>
      <ChartCard
        title="Topic frequency in your PYQ records"
        description="Number of recorded PYQ entries per topic. This reflects your dataset and does not guarantee future exam questions."
      >
        <SimpleBars rows={rows} horizontal />
      </ChartCard>
      <RecordTable
        collection="pyqs"
        records={records}
        columns={[
          { key: "year", label: "Year" },
          { key: "paper", label: "Paper" },
          { key: "question", label: "Question" },
          {
            key: "topicId",
            label: "Topic",
            render: (r) => data.topics.find((t) => t.id === r.topicId)?.name,
          },
          {
            key: "revisionNeeded",
            label: "Revision",
            render: (r) => (
              <Badge tone={r.revisionNeeded ? "amber" : "green"}>
                {r.revisionNeeded ? "Needed" : "Reviewed"}
              </Badge>
            ),
          },
        ]}
      />
    </>
  );
}
export function Tests() {
  const { data, setEditor } = useData(),
    { filters, setFilters, a } = useAnalytics();
  const records = data.tests.filter(
    (t) =>
      matches(t, filters) &&
      (!filters.testType || t.seriesId === filters.testType),
  );
  const errors = new Map<string, number>();
  records.forEach((t) =>
    Object.entries(t.errors).forEach(([n, v]) =>
      errors.set(n, (errors.get(n) || 0) + v),
    ),
  );
  const rows = [...errors].map(([name, value]) => ({ name, value }));
  const sorted = records.slice().sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <PageHeader
        eyebrow="MEASURE. REVIEW. ADJUST."
        title="Test series"
        description="See performance as percentages, review weaknesses, and keep an error log."
        action={
          <div className="button-group">
            <button
              className="btn secondary"
              onClick={() =>
                setEditor({
                  collection: "catalog",
                  preset: { type: "Test series" },
                })
              }
            >
              <Plus size={16} />
              Add Test Series
            </button>
            <AddButton collection="tests" label="Log test" />
          </div>
        }
      />
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="stats-grid three">
        <DashboardCard title="Tests recorded" value={a.tests} />
        <DashboardCard title="Average score" value={number(a.testScore, "%")} />
        <DashboardCard
          title="Latest vs previous"
          value={
            sorted.at(-1)
              ? `${round((sorted.at(-1)!.score / sorted.at(-1)!.maximum) * 100)}%`
              : "—"
          }
          detail={
            <TrendBadge
              current={
                sorted.at(-1)
                  ? (sorted.at(-1)!.score / sorted.at(-1)!.maximum) * 100
                  : null
              }
              previous={
                sorted.at(-2)
                  ? (sorted.at(-2)!.score / sorted.at(-2)!.maximum) * 100
                  : null
              }
              threshold={data.settings.trendThreshold}
              percentage
            />
          }
        />
      </div>
      <div className="chart-grid two">
        <ChartCard
          title="Test score and accuracy trend"
          description="Percentage scores and question accuracy use separate calculations. Ranks are optional and not used to predict selection."
        >
          <TestPerformance data={data} filters={filters} />
        </ChartCard>
        <ChartCard
          title="Test mistake types"
          description="Total primary error categories recorded while reviewing your tests."
        >
          <SimpleBars rows={rows} horizontal />
        </ChartCard>
      </div>
      <ChartCard
        title="Subject weakness heatmap"
        description="Combines coverage, revision, MCQs, PYQs, tests, answers, and recency. Sample sizes and thresholds matter."
      >
        <WeakTopicHeatmap data={data} filters={filters} />
      </ChartCard>
      <RecordTable
        collection="tests"
        records={records}
        columns={[
          { key: "date", label: "Date", render: (r) => prettyDate(r.date) },
          { key: "name", label: "Test" },
          { key: "stage", label: "Stage" },
          {
            key: "score",
            label: "Score",
            render: (r) => `${r.score}/${r.maximum}`,
          },
          {
            key: "percentage",
            label: "Percentage",
            render: (r) => `${round((r.score / r.maximum) * 100)}%`,
          },
          { key: "rank", label: "Rank", render: (r) => r.rank || "—" },
        ]}
      />
    </>
  );
}
