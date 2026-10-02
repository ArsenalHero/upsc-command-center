import { useState } from "react";
import { Plus } from "lucide-react";
import type { Collection, Entity, AppData, Stage } from "../types";
import {
  errorTypes,
  revisionStages,
  topicStatuses,
  studyTypes,
} from "../types";
import { useData } from "../hooks/useData";
import { uid, dateKey } from "../utils/date";
import { Modal } from "./ui";
interface Field {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "date"
    | "time"
    | "textarea"
    | "select"
    | "checkbox"
    | "subject"
    | "topic"
    | "resource"
    | "activity"
    | "series"
    | "parent"
    | "paper"
    | "color";
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  default?: unknown;
  section?: string;
}
const f = (
  key: string,
  label: string,
  type: Field["type"] = "text",
  extra: Partial<Field> = {},
): Field => ({ key, label, type, ...extra });
const n = (key: string, label: string, extra: Partial<Field> = {}) =>
  f(key, label, "number", { min: 0, ...extra });
const date = f("date", "Date", "date", { required: true });
const subject = f("subjectId", "Subject", "subject", { required: true });
const topic = f("topicId", "Topic", "topic");
const stage = f("stage", "Stage", "select", {
  options: ["Prelims", "Mains", "Both", "Optional", "CSAT"],
  default: "Prelims",
});
export const formTitles: Partial<Record<Collection, string>> = {
  sessions: "Study Session",
  mcqs: "MCQ Practice",
  tests: "Test",
  answers: "Mains Answer",
  essays: "Essay",
  ethics: "Ethics Case Study",
  currentAffairs: "Current Affairs Note",
  pyqs: "PYQ",
  revisions: "Revision",
  resources: "Resource",
  subjects: "Subject",
  topics: "Topic",
  catalog: "Custom Item",
  goals: "Goal",
};
export const fieldSchemas: Record<Collection, Field[]> = {
  sessions: [
    date,
    f("startTime", "Start time", "time"),
    f("endTime", "End time", "time"),
    stage,
    f("paper", "Paper", "paper"),
    subject,
    topic,
    f("subtopicId", "Subtopic", "topic"),
    f("resourceId", "Resource", "resource"),
    f("activity", "Study type", "activity", { default: "New Learning" }),
    n("plannedMinutes", "Planned minutes", { default: 120, max: 1440 }),
    n("actualMinutes", "Actual minutes", { default: 60, max: 1440 }),
    n("questionsPlanned", "Questions planned"),
    n("questionsAttempted", "Questions attempted"),
    n("correct", "Correct"),
    n("incorrect", "Incorrect"),
    n("pyqs", "PYQs attempted"),
    n("mainsAnswers", "Mains answers written"),
    f("revisionDone", "Revision completed", "checkbox"),
    n("mockScore", "Mock test score"),
    n("maximumMarks", "Maximum marks", { min: 1, default: 200 }),
    n("focus", "Focus · 1–10", { min: 1, max: 10, default: 7 }),
    n("energy", "Energy · 1–10", { min: 1, max: 10, default: 7 }),
    n("difficulty", "Difficulty · 1–5", { min: 1, max: 5, default: 3 }),
    n("distractionMinutes", "Distraction minutes", { max: 1440 }),
    f("nextRevisionDate", "Next revision date", "date"),
    f("notes", "Study notes", "textarea"),
    f("problems", "Problems / gaps", "textarea"),
  ],
  mcqs: [
    date,
    subject,
    topic,
    stage,
    n("seen", "Questions seen"),
    n("attempted", "Questions attempted"),
    n("correct", "Correct"),
    n("incorrect", "Incorrect"),
    n("minutes", "Time · minutes"),
    n("difficulty", "Difficulty · 1–5", { min: 1, max: 5, default: 3 }),
    n("revisedErrors", "Errors revised"),
    f("notes", "Notes / repeated mistakes", "textarea"),
  ],
  tests: [
    date,
    f("name", "Test name", "text", { required: true }),
    f("seriesId", "Test series", "series"),
    f("subjectId", "Subject (optional)", "subject"),
    topic,
    stage,
    n("score", "Score", { min: -200 }),
    n("maximum", "Maximum marks", { default: 200, min: 1 }),
    n("rank", "Rank (0 = not recorded)"),
    n("attempted", "Questions attempted"),
    n("correct", "Correct answers"),
    f("strongTopics", "Strong topics", "textarea"),
    f("weakTopics", "Weak topics", "textarea"),
    f("notes", "Review notes", "textarea"),
  ],
  answers: [
    date,
    f("paper", "Paper", "paper", { default: "GS-II" }),
    subject,
    topic,
    f("question", "Question", "textarea", { required: true }),
    n("marks", "Maximum marks", { default: 10, min: 1 }),
    n("wordLimit", "Word limit", { default: 150 }),
    n("minutes", "Time · minutes", { default: 10 }),
    n("introduction", "Introduction · 0–5", { max: 5 }),
    n("body", "Body · 0–5", { max: 5 }),
    n("conclusion", "Conclusion · 0–5", { max: 5 }),
    f("examples", "Examples used", "checkbox"),
    f("data", "Data used", "checkbox"),
    f("diagram", "Diagram used", "checkbox"),
    f("articles", "Constitutional articles", "checkbox"),
    f("reports", "Reports referenced", "checkbox"),
    n("score", "Awarded score"),
    f("notes", "Improvements", "textarea"),
  ],
  essays: [
    date,
    f("topic", "Essay topic", "textarea", { required: true }),
    f("category", "Category"),
    n("words", "Word count", { default: 1200 }),
    n("minutes", "Time · minutes", { default: 90 }),
    ...[
      "introduction",
      "structure",
      "arguments",
      "examples",
      "multidimensionality",
      "conclusion",
    ].map((k) =>
      n(k, k.charAt(0).toUpperCase() + k.slice(1) + " · 0–5", { max: 5 }),
    ),
    n("mentorScore", "Mentor score"),
    n("selfScore", "Self score"),
    n("maximum", "Maximum marks", { default: 125, min: 1 }),
    f("improvements", "Improvements", "textarea"),
  ],
  ethics: [
    date,
    topic,
    f("caseStudy", "Case study", "textarea", { required: true }),
    n("minutes", "Time · minutes", { default: 20 }),
    f("stakeholders", "Stakeholders", "textarea"),
    f("dilemma", "Ethical dilemma", "textarea"),
    f("alternatives", "Alternatives", "textarea"),
    f("justification", "Justification", "textarea"),
    n("structure", "Structure · 0–5", { max: 5 }),
    n("score", "Score"),
    n("maximum", "Maximum marks", { default: 20, min: 1 }),
  ],
  currentAffairs: [
    date,
    f("title", "Headline / issue", "text", { required: true }),
    f("source", "Source / URL"),
    subject,
    topic,
    f("prelims", "Prelims relevance", "checkbox", { default: true }),
    f("mains", "Mains relevance", "checkbox", { default: true }),
    f("staticLink", "Static syllabus connection"),
    f("revised", "Revision completed", "checkbox"),
    f("notes", "Notes / analysis", "textarea"),
  ],
  pyqs: [
    date,
    n("year", "Question year", {
      default: new Date().getFullYear() - 1,
      min: 1970,
      max: 2200,
    }),
    stage,
    f("paper", "Paper", "paper"),
    subject,
    topic,
    f("question", "Question / batch description", "textarea", {
      required: true,
    }),
    n("correct", "Correct"),
    n("incorrect", "Incorrect"),
    n("difficulty", "Difficulty · 1–5", { min: 1, max: 5, default: 3 }),
    f("conceptGap", "Concept gap", "textarea"),
    f("revisionNeeded", "Revision needed", "checkbox"),
  ],
  revisions: [
    subject,
    f("topicId", "Topic", "topic", { required: true }),
    f("dueDate", "Due date", "date", { required: true, default: dateKey() }),
    f("stage", "Revision stage", "select", {
      options: revisionStages,
      default: "Revision 1",
    }),
    f("completedDate", "Completed date (leave empty if pending)", "date"),
    f("notes", "Revision plan", "textarea"),
  ],
  resources: [
    f("name", "Resource name", "text", { required: true }),
    f("subjectId", "Subject", "subject"),
    topic,
    f("type", "Resource type", "select", {
      options: [
        "Book",
        "Notes",
        "Course",
        "Coaching module",
        "Website",
        "Test series",
        "Video",
        "Other",
      ],
      default: "Book",
    }),
    f("url", "URL"),
    f("notes", "Notes", "textarea"),
  ],
  subjects: [
    f("name", "Subject name", "text", { required: true }),
    stage,
    f("paper", "Paper / category"),
    f("color", "Chart color", "color", { default: "#3158eb" }),
    n("priority", "Importance · 1–5", { min: 1, max: 5, default: 3 }),
    n("targetAllocation", "Subject target allocation %", {
      max: 100,
      default: 5,
    }),
  ],
  topics: [
    subject,
    f("parentId", "Parent topic / unit", "parent"),
    f("name", "Topic or subtopic name", "text", { required: true }),
    f("status", "Completion status", "select", {
      options: topicStatuses,
      default: "Not Started",
    }),
    f("revisionStage", "Learning stage", "select", {
      options: revisionStages,
      default: "New topic",
    }),
    n("importance", "Importance · 1–5", { min: 1, max: 5, default: 3 }),
    f("notes", "Notes", "textarea"),
  ],
  catalog: [
    f("name", "Name", "text", { required: true }),
    f("type", "Type", "select", {
      options: [
        "Activity",
        "Course",
        "Coaching module",
        "Test series",
        "Category",
      ],
      default: "Activity",
    }),
    f("subjectId", "Subject (optional)", "subject"),
    f("notes", "Notes", "textarea"),
  ],
  goals: [
    f("name", "Goal name", "text", { required: true }),
    f("metric", "Metric", "select", {
      options: [
        "Hours",
        "MCQs",
        "Answers",
        "Essays",
        "Tests",
        "Revision",
        "Optional hours",
        "CSAT hours",
        "PYQs",
        "Syllabus %",
      ],
      default: "Hours",
    }),
    n("target", "Target", { min: 0.1, default: 8 }),
    f("period", "Period", "select", {
      options: ["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"],
      default: "Daily",
    }),
    f("subjectId", "Subject (optional)", "subject"),
  ],
};
export function RecordForm({
  collection,
  record,
  preset,
  onClose,
}: {
  collection: Collection;
  record?: Entity;
  preset?: Record<string, unknown>;
  onClose: () => void;
}) {
  const { data, saveRecord } = useData();
  const [values, setValues] = useState<Record<string, any>>(() => {
    const base: Record<string, any> = {
      id: uid(),
      ...(collection === "topics"
        ? { createdAt: dateKey(), statusHistory: [], parentId: null }
        : {}),
      ...(["mcqs", "tests"].includes(collection) ? { errors: {} } : {}),
    };
    fieldSchemas[collection].forEach(
      (field) =>
        (base[field.key] =
          field.default ??
          (field.type === "date" && field.key === "date"
            ? dateKey()
            : field.type === "number"
              ? 0
              : field.type === "checkbox"
                ? false
                : field.type === "subject" && field.required
                  ? data.subjects[0]?.id || ""
                  : field.type === "parent"
                    ? null
                    : "")),
    );
    if (collection === "subjects") base.stage = "Both";
    if (collection === "ethics")
      base.topicId =
        data.topics.find(
          (t) =>
            data.subjects.find((s) => s.id === t.subjectId)?.paper === "GS-IV",
        )?.id || "";
    return { ...base, ...record, ...preset };
  });
  const change = (key: string, value: any) =>
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === "subjectId") {
        next.topicId = "";
        next.subtopicId = "";
        if (collection === "sessions") next.resourceId = "";
        if (collection === "topics") next.parentId = null;
        const s = data.subjects.find((s) => s.id === value);
        if (s && collection === "sessions") {
          next.stage = s.stage;
          next.paper = s.paper;
        }
      }
      if (
        ["attempted", "correct", "questionsAttempted"].includes(key) &&
        ["mcqs", "sessions"].includes(collection)
      ) {
        const a = collection === "mcqs" ? "attempted" : "questionsAttempted";
        next.incorrect = Math.max(0, Number(next[a]) - Number(next.correct));
        if (collection === "mcqs")
          next.seen = Math.max(Number(next.seen), Number(next.attempted));
      }
      if (
        ["startTime", "endTime"].includes(key) &&
        next.startTime &&
        next.endTime
      ) {
        const minutes = (s: string) =>
          Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
        next.actualMinutes =
          (minutes(next.endTime) - minutes(next.startTime) + 1440) % 1440;
      }
      return next;
    });
  const choices = (field: Field): { value: string; label: string }[] => {
    if (field.options)
      return field.options.map((v) => ({ value: v, label: v }));
    if (field.type === "subject")
      return data.subjects.map((s) => ({ value: s.id, label: s.name }));
    if (field.type === "paper")
      return [
        ...new Set(
          data.subjects.flatMap((s) =>
            s.stage === "Optional"
              ? ["Optional I", "Optional II", s.paper]
              : [s.paper],
          ),
        ),
      ].map((v) => ({ value: v, label: v }));
    if (field.type === "activity")
      return [
        ...new Set([
          ...studyTypes,
          ...data.catalog
            .filter((x) => x.type === "Activity" || x.type === "Category")
            .map((x) => x.name),
        ]),
      ].map((v) => ({ value: v, label: v }));
    if (field.type === "resource")
      return data.resources
        .filter(
          (r) =>
            !r.subjectId ||
            !values.subjectId ||
            r.subjectId === values.subjectId,
        )
        .map((r) => ({ value: r.id, label: r.name }));
    if (field.type === "series")
      return data.catalog
        .filter((x) => x.type === "Test series")
        .map((s) => ({ value: s.id, label: s.name }));
    if (field.type === "topic" || field.type === "parent")
      return data.topics
        .filter(
          (t) =>
            (!values.subjectId || t.subjectId === values.subjectId) &&
            t.id !== values.id &&
            (field.key !== "subtopicId" ||
              !values.topicId ||
              t.parentId === values.topicId),
        )
        .map((t) => {
          const parent = data.topics.find((p) => p.id === t.parentId);
          return {
            value: t.id,
            label: parent ? `${parent.name} / ${t.name}` : t.name,
          };
        });
    return [];
  };
  return (
    <Modal
      title={`${record ? "Edit" : "Add"} ${formTitles[collection] || collection}`}
      onClose={onClose}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveRecord(collection, values as Entity);
        }}
      >
        <div className="modal-body">
          <div className="form-grid">
            {fieldSchemas[collection].map((field) => {
              const label = field.label + (field.required ? " *" : "");
              const select = [
                "select",
                "subject",
                "topic",
                "parent",
                "resource",
                "activity",
                "series",
                "paper",
              ].includes(field.type);
              return (
                <label
                  key={field.key}
                  className={`${field.type === "textarea" ? "span-2" : ""} ${field.type === "checkbox" ? "check-label" : ""}`}
                >
                  {field.type === "checkbox" ? (
                    <>
                      <input
                        type="checkbox"
                        checked={values[field.key] || false}
                        onChange={(e) => change(field.key, e.target.checked)}
                      />
                      <span>{label}</span>
                    </>
                  ) : (
                    <>
                      <span>{label}</span>
                      {select ? (
                        <select
                          required={field.required}
                          value={values[field.key] ?? ""}
                          onChange={(e) =>
                            change(
                              field.key,
                              field.type === "parent"
                                ? e.target.value || null
                                : e.target.value,
                            )
                          }
                        >
                          <option value="">
                            {field.type === "parent"
                              ? "Top level (no parent)"
                              : "Select…"}
                          </option>
                          {choices(field).map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          required={field.required}
                          rows={3}
                          value={values[field.key] || ""}
                          onChange={(e) => change(field.key, e.target.value)}
                        />
                      ) : (
                        <input
                          type={field.type}
                          required={field.required}
                          value={values[field.key] ?? ""}
                          min={field.min}
                          max={field.max}
                          step={field.type === "number" ? "any" : undefined}
                          onChange={(e) =>
                            change(
                              field.key,
                              field.type === "number"
                                ? Number(e.target.value)
                                : e.target.value,
                            )
                          }
                        />
                      )}
                    </>
                  )}
                </label>
              );
            })}
          </div>
          {["mcqs", "tests"].includes(collection) && (
            <fieldset className="error-fields">
              <legend>
                Error classification · one primary category per wrong answer
              </legend>
              <div className="form-grid">
                {errorTypes.map((name) => (
                  <label key={name}>
                    {name}
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={values.errors?.[name] || 0}
                      onChange={(e) =>
                        change("errors", {
                          ...values.errors,
                          [name]: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {collection === "sessions" && (
            <p className="form-note">
              Questions and mock tests logged here feed the practice charts
              automatically. Schedule a next revision date to add it to your
              calendar.
            </p>
          )}
          {collection === "topics" && (
            <p className="form-note">
              Use the parent field to build units, topics, and unlimited levels
              of subtopics. The syllabus measures leaf topics.
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            <Plus size={16} />
            {record ? "Save changes" : "Save record"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export const StudySessionForm = RecordForm;
export const TestForm = RecordForm;
export const MCQForm = RecordForm;
export const AnswerWritingForm = RecordForm;
export function GlobalEditor() {
  const { editor, setEditor } = useData();
  return editor ? (
    <RecordForm
      key={editor.record?.id || editor.collection}
      {...editor}
      onClose={() => setEditor(null)}
    />
  ) : null;
}
