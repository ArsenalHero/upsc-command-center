import { Plus, Edit3, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useData } from "../hooks/useData";
import { goalValue } from "../utils/analytics";
import { number, prettyDate } from "../utils/date";
import { COLORS } from "../data/defaults";
import {
  PageHeader,
  ProgressRing,
  Badge,
  EmptyState,
  ConfirmDialog,
} from "../components/ui";
import type { Goal } from "../types";
export function GoalCard({
  goal,
  index,
  onRemove,
}: {
  goal: Goal;
  index: number;
  onRemove: () => void;
}) {
  const { data, setEditor } = useData(),
    a = useMemo(() => goalValue(data, goal), [data, goal]);
  return (
    <article className="card goal-card">
      <div className="card-heading">
        <Badge tone="blue">{goal.period}</Badge>
        <div>
          <button
            className="icon-btn"
            aria-label={`Edit ${goal.name}`}
            onClick={() => setEditor({ collection: "goals", record: goal })}
          >
            <Edit3 size={15} />
          </button>
          <button
            className="icon-btn"
            aria-label={`Delete ${goal.name}`}
            onClick={onRemove}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <ProgressRing
        value={a.progress}
        size={100}
        color={COLORS[index % COLORS.length]}
      />
      <h2>{goal.name}</h2>
      <strong>
        {number(a.value)} / {goal.target}
        <small> {goal.metric.toLowerCase()}</small>
      </strong>
      <p>
        {goal.subjectId
          ? data.subjects.find((s) => s.id === goal.subjectId)?.name
          : "All subjects"}{" "}
        · {prettyDate(a.from)}–{prettyDate(a.to)}
      </p>
      <Badge tone={a.progress >= 100 ? "green" : "neutral"}>
        {a.progress >= 100
          ? "Target reached"
          : `${Math.max(0, goal.target - a.value).toFixed(1)} remaining`}
      </Badge>
    </article>
  );
}
export default function Goals() {
  const { data, setEditor, deleteRecord } = useData(),
    [period, setPeriod] = useState("All"),
    [remove, setRemove] = useState<string | null>(null);
  const goals = data.goals.filter(
    (g) => period === "All" || g.period === period,
  );
  return (
    <>
      <PageHeader
        eyebrow="TURN INTENT INTO TARGETS"
        title="Goals & progress"
        description="Set measurable goals for hours, practice, revision, and syllabus coverage."
        action={
          <button
            className="btn primary"
            onClick={() => setEditor({ collection: "goals" })}
          >
            <Plus size={16} />
            Add custom goal
          </button>
        }
      />
      <div className="tabs" role="tablist" aria-label="Goal period">
        {["All", "Daily", "Weekly", "Monthly", "Quarterly", "Yearly"].map(
          (p) => (
            <button
              key={p}
              role="tab"
              aria-selected={p === period}
              className={p === period ? "active" : ""}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ),
        )}
      </div>
      {goals.length ? (
        <div className="goal-grid">
          {goals.map((goal, i) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={i}
              onRemove={() => setRemove(goal.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No goals for this period."
          text="Choose a metric and a target you can review consistently."
          action="Add goal"
          onAction={() =>
            setEditor({
              collection: "goals",
              preset: period === "All" ? undefined : { period },
            })
          }
        />
      )}
      <p className="page-note">
        Custom goal targets are independent of your preparation targets in
        Settings. Hours are recorded study time, not planned time.
      </p>
      {remove && (
        <ConfirmDialog
          title="Delete goal?"
          text="Your study records will remain. This removes only the goal."
          label="Delete goal"
          danger
          onClose={() => setRemove(null)}
          onConfirm={() => deleteRecord("goals", remove)}
        />
      )}
    </>
  );
}
