import { useMemo } from "react";
import { Edit3, Plus, BookOpen, RotateCcw } from "lucide-react";
import { useData } from "../hooks/useData";
import { aggregate, emptyFilters } from "../utils/analytics";
import { dateKey, addDays, prettyDate, number } from "../utils/date";
import {
  Modal,
  DashboardCard,
  Badge,
  ChartCard,
  ProgressBar,
  statusTone,
} from "./ui";
import { SimpleTrend } from "../charts";
import { revisionStages } from "../types";
export function TopicDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { data, setEditor } = useData(),
    topic = data.topics.find((t) => t.id === id);
  const a = useMemo(
    () =>
      aggregate(
        data,
        addDays(dateKey(), -364),
        dateKey(),
        topic?.subjectId || "",
        { topicId: id },
      ),
    [data, id, topic?.subjectId],
  );
  if (!topic) return null;
  const last = data.sessions
    .filter((s) => s.topicId === id || s.subtopicId === id)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const revisions = data.revisions.filter((r) => r.topicId === id),
    next = revisions
      .filter((r) => !r.completedDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const resources = data.resources.filter(
      (r) => r.topicId === id || r.subjectId === topic.subjectId,
    ),
    mistakes = data.mcqs.filter((m) => m.topicId === id && m.incorrect > 0);
  const rows = data.sessions
    .filter((s) => s.topicId === id)
    .map((s) => ({ date: s.date, hours: s.actualMinutes / 60 }));
  return (
    <Modal title={topic.name} onClose={onClose} wide>
      <div className="modal-body">
        <div className="topic-detail-top">
          <Badge tone={statusTone(topic.status)}>{topic.status}</Badge>
          <span>
            {data.subjects.find((s) => s.id === topic.subjectId)?.name}
          </span>
          <button
            className="btn secondary small-btn"
            onClick={() => {
              onClose();
              setEditor({ collection: "topics", record: topic });
            }}
          >
            <Edit3 size={14} />
            Edit topic
          </button>
        </div>
        <div className="stats-grid three">
          <DashboardCard title="Study hours" value={number(a.hours, "h")} />
          <DashboardCard
            title="MCQ accuracy"
            value={number(a.accuracy, "%")}
            detail={`${a.attempted} questions`}
          />
          <DashboardCard
            title="PYQs / answers"
            value={`${a.pyqs} / ${a.answers}`}
          />
        </div>
        <div className="topic-meta">
          <span>
            Last studied{" "}
            <strong>{last ? prettyDate(last.date) : "Not recorded"}</strong>
          </span>
          <span>
            Next revision{" "}
            <strong>{next ? prettyDate(next.dueDate) : "Not scheduled"}</strong>
          </span>
          <span>
            Test score <strong>{number(a.testScore, "%")}</strong>
          </span>
        </div>
        <h3>Learning & revision lifecycle</h3>
        <div className="lifecycle">
          {revisionStages.map((stage, i) => (
            <div
              key={stage}
              className={
                i <= revisionStages.indexOf(topic.revisionStage)
                  ? "reached"
                  : ""
              }
            >
              <span>{i + 1}</span>
              {stage}
            </div>
          ))}
        </div>
        <button
          className="btn secondary"
          onClick={() => {
            onClose();
            setEditor({
              collection: "revisions",
              preset: { subjectId: topic.subjectId, topicId: id },
            });
          }}
        >
          <Plus size={16} />
          Schedule revision
        </button>
        <ChartCard
          title="Recent study trend"
          description="Hours logged for this topic."
        >
          <SimpleTrend
            rows={rows}
            series={[{ key: "hours", name: "Study hours", color: "#3158eb" }]}
            unit="h"
          />
        </ChartCard>
        <h3>Topic notes</h3>
        <p className="preserve-text">{topic.notes || "No topic notes yet."}</p>
        <h3>Resources</h3>
        <ul className="simple-list">
          {resources.length ? (
            resources.map((r) => <li key={r.id}>{r.name}</li>)
          ) : (
            <li>No linked resources.</li>
          )}
        </ul>
        <h3>Recent mistakes</h3>
        <ul className="simple-list">
          {mistakes.slice(-5).map((m) => (
            <li key={m.id}>
              {prettyDate(m.date)} · {m.incorrect} incorrect ·{" "}
              {Object.entries(m.errors)
                .map(([n, v]) => `${n}: ${v}`)
                .join(", ") || "Not classified"}
            </li>
          ))}
          {!mistakes.length && <li>No recorded mistakes.</li>}
        </ul>
        <h3>Related current affairs</h3>
        <ul className="simple-list">
          {data.currentAffairs
            .filter((c) => c.topicId === id || c.subjectId === topic.subjectId)
            .slice(-5)
            .map((c) => (
              <li key={c.id}>
                {c.title} · {c.staticLink || "Add static connection"}
              </li>
            ))}
        </ul>
        <h3>Session notes</h3>
        <ul className="simple-list">
          {a.sessions
            .filter((s) => s.notes)
            .slice(-5)
            .map((s) => (
              <li key={s.id}>
                {prettyDate(s.date)}: {s.notes}
              </li>
            ))}
        </ul>
      </div>
    </Modal>
  );
}
