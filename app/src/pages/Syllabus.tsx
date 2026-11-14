import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { useData } from "../hooks/useData";
import type { Topic, TopicStatus } from "../types";
import { topicStatuses } from "../types";
import { coverage } from "../utils/analytics";
import {
  PageHeader,
  ChartCard,
  ProgressBar,
  Badge,
  statusTone,
  EmptyState,
} from "../components/ui";
import { SyllabusMap } from "../charts";
import { TopicDetail } from "../components/TopicDetail";
import { SubjectFilter } from "../components/Filters";
export function SyllabusTree({
  subjectId,
  query = "",
}: {
  subjectId: string;
  query?: string;
}) {
  const { data, setTopicStatus, setEditor } = useData();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [topicId, setTopicId] = useState<string | null>(null);
  const topics = data.topics.filter((t) => t.subjectId === subjectId);
  const searchable = new Set<string>();
  if (query)
    topics
      .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
      .forEach((t) => {
        searchable.add(t.id);
        let p = t.parentId;
        while (p) {
          searchable.add(p);
          p = topics.find((t) => t.id === p)?.parentId || null;
        }
      });
  const draw = (t: Topic, depth: number): React.ReactNode => {
    if (query && !searchable.has(t.id)) return null;
    const children = topics.filter((c) => c.parentId === t.id),
      expanded = query || open.has(t.id);
    return (
      <div key={t.id}>
        <div
          className={`syllabus-row${children.length ? " syllabus-parent" : ""}`}
          style={{ "--topic-depth": Math.min(depth, 5) } as CSSProperties}
        >
          {children.length ? (
            <button
              className="icon-btn"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${t.name}`}
              aria-expanded={!!expanded}
              onClick={() =>
                setOpen((s) => {
                  const n = new Set(s);
                  n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                  return n;
                })
              }
            >
              {expanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          ) : (
            <span className="tree-leaf">
              <BookOpen size={14} />
            </span>
          )}
          <button className="topic-name" onClick={() => setTopicId(t.id)}>
            {t.name}
          </button>
          <select
            className={`status-select ${statusTone(t.status)}`}
            aria-label={`Status of ${t.name}`}
            value={t.status}
            onChange={(e) =>
              setTopicStatus(t.id, e.target.value as TopicStatus)
            }
          >
            {topicStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            className="icon-btn"
            aria-label={`Add subtopic to ${t.name}`}
            onClick={() =>
              setEditor({
                collection: "topics",
                preset: { subjectId, parentId: t.id },
              })
            }
          >
            <Plus size={15} />
          </button>
        </div>
        {expanded && children.map((c) => draw(c, depth + 1))}
      </div>
    );
  };
  return (
    <>
      {topics.filter((t) => !t.parentId).map((t) => draw(t, 0))}
      {!topics.length && (
        <EmptyState
          title="Build your subject syllabus."
          text="Add topics and subtopics at any depth."
          action="Add topic"
          onAction={() =>
            setEditor({ collection: "topics", preset: { subjectId } })
          }
        />
      )}
      <button
        className="text-btn add-topic-row"
        onClick={() =>
          setEditor({ collection: "topics", preset: { subjectId } })
        }
      >
        <Plus size={15} />
        Add topic
      </button>
      {topicId && <TopicDetail id={topicId} onClose={() => setTopicId(null)} />}
    </>
  );
}
export default function Syllabus() {
  const { data, setEditor } = useData();
  const [params, setParams] = useSearchParams();
  const [subjectId, setSubjectId] = useState(params.get("subject") || ""),
    [query, setQuery] = useState(""),
    [topicId, setTopicId] = useState<string | null>(params.get("topic"));
  useEffect(() => {
    if (params.get("topic")) setTopicId(params.get("topic"));
    if (params.get("subject")) setSubjectId(params.get("subject")!);
  }, [params]);
  const subjects = data.subjects.filter(
    (s) => !subjectId || s.id === subjectId,
  );
  const overall = coverage(data) || 0;
  return (
    <>
      <PageHeader
        eyebrow="KNOW WHAT'S LEFT"
        title="Syllabus tracker"
        description="From the whole syllabus to the smallest subtopic. Progress follows your leaf topics."
        action={
          <div className="button-group">
            <button
              className="btn secondary"
              onClick={() => setEditor({ collection: "subjects" })}
            >
              <Plus size={16} />
              Add Subject
            </button>
            <button
              className="btn primary"
              onClick={() =>
                setEditor({
                  collection: "topics",
                  preset: subjectId ? { subjectId } : undefined,
                })
              }
            >
              <Plus size={16} />
              Add Topic
            </button>
          </div>
        }
      />
      <div className="syllabus-summary card">
        <div>
          <span className="eyebrow">OVERALL COVERAGE</span>
          <strong>{overall}%</strong>
          <span className="muted">
            Completed = 100% · In progress = 50% · Not started = 0%
          </span>
        </div>
        <ProgressBar value={overall} />
      </div>
      <div className="filter-bar">
        <SubjectFilter value={subjectId} onChange={setSubjectId} />
        <div className="input-icon">
          <Search size={16} />
          <input
            aria-label="Search syllabus topics"
            placeholder="Find a topic…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="chart-grid two">
        <ChartCard
          title="Syllabus map"
          description="Each tile represents one leaf topic. Darker tiles have more completion. Select a tile to open the topic details."
        >
          <SyllabusMap data={data} subjectId={subjectId} onTopic={setTopicId} />
        </ChartCard>
        <section className="card">
          <div className="card-heading">
            <h2>Progress by paper</h2>
          </div>
          <div className="paper-progress">
            {[...new Set(data.subjects.map((s) => s.paper))].map((p) => {
              const subjectIds = new Set(
                data.subjects.filter((s) => s.paper === p).map((s) => s.id),
              );
              const subset = {
                ...data,
                topics: data.topics.filter((t) => subjectIds.has(t.subjectId)),
              };
              return (
                <ProgressBar
                  key={p}
                  label={p}
                  value={coverage(subset) || 0}
                  color={p.includes("Optional") ? "purple" : "blue"}
                />
              );
            })}
            {data.subjects.some((s) => s.stage === "Optional") &&
              ["Paper I", "Paper II"].map((name) => {
                const roots = data.topics.filter(
                  (t) =>
                    t.name === name &&
                    data.subjects.find((s) => s.id === t.subjectId)?.stage ===
                      "Optional",
                );
                const ids = new Set(roots.map((t) => t.id));
                let changed = true;
                while (changed) {
                  changed = false;
                  data.topics.forEach((t) => {
                    if (t.parentId && ids.has(t.parentId) && !ids.has(t.id)) {
                      ids.add(t.id);
                      changed = true;
                    }
                  });
                }
                return (
                  <ProgressBar
                    key={name}
                    label={`Optional ${name}`}
                    value={
                      coverage({
                        ...data,
                        topics: data.topics.filter((t) => ids.has(t.id)),
                      }) || 0
                    }
                    color="purple"
                  />
                );
              })}
          </div>
        </section>
      </div>
      <div className="syllabus-subjects">
        {subjects.map((s) => (
          <details
            className="card syllabus-subject"
            key={s.id}
            open={!!subjectId || !!query}
          >
            <summary>
              <ChevronDown size={17} />
              <span style={{ color: s.color }}>
                <BookOpen size={18} />
              </span>
              <strong>{s.name}</strong>
              <Badge>{s.paper}</Badge>
              <span className="subject-coverage">
                {coverage(data, s.id) || 0}%
              </span>
            </summary>
            <SyllabusTree subjectId={s.id} query={query} />
          </details>
        ))}
      </div>
      {topicId && (
        <TopicDetail
          id={topicId}
          onClose={() => {
            setTopicId(null);
            setParams(subjectId ? { subject: subjectId } : {});
          }}
        />
      )}
    </>
  );
}
