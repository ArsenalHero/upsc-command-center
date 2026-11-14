import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronDown, Clock3, RotateCcw, Target } from "lucide-react";
import type { AppData, StudySession } from "../types";
import { studyTypes } from "../types";
import { addDays, dateKey } from "../utils/date";
import { recentStudySessions } from "../utils/studyForm";
import "./study-session-form.css";

const activities = ["New Learning", "Revision", "MCQ", "PYQ", "Answer Writing", "Mock Test"];
type RenderField = (key: string, extra?: { label?: string; min?: number; max?: number; required?: boolean }) => ReactNode;

function OptionalSection({ id, title, hint, active = false, children }: {
  id: string; title: string; hint: string; active?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(active);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  return (
    <section className="study-extra">
      <button type="button" className="study-extra-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span><strong>{title}</strong><small>{hint}</small></span>
        <ChevronDown size={18} className={open ? "is-open" : ""} aria-hidden="true" />
      </button>
      <div id={id} hidden={!open} className="study-extra-content">{children}</div>
    </section>
  );
}

export function StudySessionFields({ data, values, editing, renderField, change, repeat }: {
  data: AppData; values: StudySession; editing: boolean; renderField: RenderField;
  change: (key: string, value: any) => void; repeat: (session: StudySession) => void;
}) {
  const recent = recentStudySessions(data);
  const subject = data.subjects.find((s) => s.id === values.subjectId);
  const isPractice = ["MCQ", "PYQ", "Mock Test", "CSAT"].includes(values.activity);
  const isWriting = ["Answer Writing", "Essay"].includes(values.activity);
  const hasResults = !!(values.questionsAttempted || values.pyqs || values.mainsAnswers || values.mockScore);
  const correct = Number(values.correct), attempted = Number(values.questionsAttempted);
  const otherActivities = [...new Set([...studyTypes, ...data.catalog.filter((x) => ["Activity", "Category"].includes(x.type)).map((x) => x.name), values.activity])].filter((a) => !activities.includes(a));
  const hasSubtopics = data.topics.some((t) => t.parentId === values.topicId && t.subjectId === values.subjectId);
  return (
    <div className="study-session-fields">
      <div className="study-form-intro">
        <span className="study-form-icon"><BookOpen size={21} aria-hidden="true" /></span>
        <div><h3>{editing ? "Update your study" : "Make your study count"}</h3><p>Subject, activity and time. Add more detail whenever it helps.</p></div>
      </div>
      {!editing && recent.length > 0 && (
        <div className="study-recent">
          <span className="study-field-label"><RotateCcw size={14} aria-hidden="true" />Use a recent subject & activity</span>
          <div className="study-chip-row">
            {recent.map((s) => (
              <button type="button" className="study-recent-chip" key={s.id} onClick={() => repeat(s)} title={data.topics.find((t) => t.id === s.topicId)?.name || s.activity}>
                <strong>{data.subjects.find((subject) => subject.id === s.subjectId)?.name}</strong>
                <span>{s.activity}{s.topicId ? ` · ${data.topics.find((t) => t.id === s.topicId)?.name || ""}` : ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="study-date-row">
        {renderField("date", { label: "Study date" })}
        <div className="study-chip-row study-date-shortcuts">
          {[{ label: "Today", date: dateKey() }, { label: "Yesterday", date: addDays(dateKey(), -1) }].map((day) => (
            <button type="button" className="study-chip" key={day.label} aria-pressed={values.date === day.date} onClick={() => change("date", day.date)}>{day.label}</button>
          ))}
        </div>
      </div>
      <div className="form-grid study-essentials">
        {renderField("subjectId")}
        <div className="study-duration">
          {renderField("actualMinutes", { label: "Time spent · minutes", required: true })}
          <div className="study-chip-row" aria-label="Quick study duration">
            {[25, 30, 60, 90, 120].map((minutes) => (
              <button type="button" className="study-chip" aria-pressed={values.actualMinutes === minutes} key={minutes} onClick={() => change("actualMinutes", minutes)}>{minutes}m</button>
            ))}
          </div>
        </div>
      </div>
      <fieldset className="study-activity">
        <legend>What did you do?</legend>
        <div className="study-activity-grid">
          {activities.map((activity) => (
            <button type="button" className="study-activity-chip" key={activity} aria-pressed={values.activity === activity} onClick={() => change("activity", activity)}>
              {values.activity === activity && <Check size={14} aria-hidden="true" />}{activity === "MCQ" ? "MCQ practice" : activity === "PYQ" ? "PYQ practice" : activity}
            </button>
          ))}
        </div>
        <label className="study-other-activity"><span>More activities</span>
          <select value={activities.includes(values.activity) ? "" : values.activity} onChange={(e) => { if (e.target.value) change("activity", e.target.value); }}>
            <option value="">Essay, current affairs, notes…</option>
            {otherActivities.map((activity) => <option value={activity} key={activity}>{activity}</option>)}
          </select>
        </label>
      </fieldset>
      <div className="form-grid study-topic-row">{renderField("topicId", { label: "Topic · optional" })}</div>
      <div className="study-optionals-heading"><span>Go a little deeper</span><small>Optional · expand what matters</small></div>
      <OptionalSection id="study-results" title="Practice & output" hint={hasResults ? `${attempted} questions · ${values.pyqs} PYQs · ${values.mainsAnswers} answers` : "Questions, PYQs, answers and test scores"} active={isPractice || isWriting || hasResults}>
        {(isPractice || attempted > 0 || values.correct > 0 || values.incorrect > 0) && <>
          <div className="form-grid">{renderField("questionsAttempted")}{renderField("correct", { label: "Correct answers", max: attempted })}</div>
          <div className="study-result-summary"><Target size={15} aria-hidden="true" /><span>{values.incorrect} incorrect · {attempted > 0 ? `${Math.round(correct / attempted * 100)}% accuracy` : "Add your results"}</span><small>Incorrect calculated for you</small></div>
          {correct > attempted && <p className="study-inline-error" role="alert">Correct answers cannot exceed questions attempted.</p>}
        </>}
        <div className="form-grid">{renderField("pyqs")}{renderField("mainsAnswers")}</div>
        {(values.activity === "Mock Test" || values.mockScore !== 0) && <div className="form-grid">{renderField("mockScore")}{renderField("maximumMarks")}</div>}
        {!isPractice && !attempted && !values.correct && !values.incorrect && <details className="study-small-details"><summary>Add MCQ results</summary><div className="form-grid">{renderField("questionsAttempted")}{renderField("correct", { max: attempted })}</div></details>}
      </OptionalSection>
      <OptionalSection id="study-context" title="Syllabus & resource" hint={[values.stage, values.paper, values.resourceId ? data.resources.find((r) => r.id === values.resourceId)?.name : "Paper chosen from your subject"].filter(Boolean).join(" · ")} active={editing && !!(values.subtopicId || values.resourceId)}>
        <div className="form-grid">{renderField("stage")}{renderField("paper")}
          {hasSubtopics || values.subtopicId ? renderField("subtopicId") : <p className="form-note">Choose a topic with subtopics to add more detail.</p>}
          {renderField("resourceId")}
        </div>
      </OptionalSection>
      <OptionalSection id="study-planning" title="Planning & revision" hint={values.nextRevisionDate ? `Next revision: ${values.nextRevisionDate}` : values.revisionDone ? "Revision completed" : "Targets, exact times and your next review"} active={values.activity === "Revision" || !!(values.plannedMinutes || values.nextRevisionDate || values.startTime || values.endTime)}>
        <div className="form-grid">{renderField("plannedMinutes")}{renderField("questionsPlanned")}{renderField("startTime")}{renderField("endTime")}{renderField("revisionDone")}</div>
        <div className="study-revision-date">{renderField("nextRevisionDate")}<div className="study-chip-row" aria-label="Revision date shortcuts">
          {[1, 3, 7].map((days) => <button type="button" key={days} className="study-chip" aria-pressed={values.nextRevisionDate === addDays(values.date, days)} onClick={() => change("nextRevisionDate", addDays(values.date, days))}>+{days} {days === 1 ? "day" : "days"}</button>)}
          {values.nextRevisionDate && <button type="button" className="text-btn" onClick={() => change("nextRevisionDate", "")}>Clear</button>}
        </div></div>
        {values.nextRevisionDate && !values.topicId && <p className="study-inline-error" role="alert">Choose a topic above to add this review to your revision calendar.</p>}
        <p className="form-note">Start and end times calculate duration, including sessions past midnight. Enter 0 time spent to plan a session.</p>
      </OptionalSection>
      <OptionalSection id="study-reflection" title="Focus & reflection" hint={`Focus ${values.focus}/10 · energy ${values.energy}/10 · difficulty ${values.difficulty}/5`} active={editing && !!(values.notes || values.problems || values.distractionMinutes)}>
        <p className="form-note">Ratings start at 7, 7 and 3. Adjust them to reflect this session.</p>
        <div className="form-grid">{renderField("focus")}{renderField("energy")}{renderField("difficulty")}{renderField("distractionMinutes")}{renderField("notes", { label: "What did you learn?" })}{renderField("problems", { label: "What needs another look?" })}</div>
      </OptionalSection>
      <div className="study-save-preview" aria-live="polite"><Clock3 size={16} aria-hidden="true" /><span><strong>{Number(values.actualMinutes) || 0} min</strong> · {subject?.name || "Choose a subject"} · {values.activity}</span></div>
      <p className="form-note study-form-note">Your time and practice results feed your reports. A topic and next review date add a revision reminder.</p>
    </div>
  );
}
