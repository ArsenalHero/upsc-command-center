import type { AppData, StudySession } from "../types";

// Reuse context, never a previous session's time, scores, or reflection.
export function recentStudySessions(data: AppData): StudySession[] {
  const seen = new Set<string>();
  return data.sessions
    .filter((s) => !s.demo && data.subjects.some((subject) => subject.id === s.subjectId))
    .slice()
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((s) => {
      const key = [s.subjectId, s.topicId, s.subtopicId, s.resourceId, s.activity].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}

export function studyContext(data: AppData, session: Partial<StudySession>) {
  const subject = data.subjects.find((s) => s.id === session.subjectId);
  const topic = data.topics.find((t) => t.id === session.topicId && t.subjectId === subject?.id);
  const subtopic = data.topics.find((t) => t.id === session.subtopicId && t.subjectId === subject?.id && t.parentId === topic?.id);
  const resource = data.resources.find((r) => r.id === session.resourceId && (!r.subjectId || r.subjectId === subject?.id));
  return {
    subjectId: subject?.id || "",
    stage: session.stage || subject?.stage || "Prelims",
    paper: session.paper || subject?.paper || "",
    topicId: topic?.id || "",
    subtopicId: topic ? subtopic?.id || "" : "",
    resourceId: resource?.id || "",
    activity: session.activity || "New Learning",
  };
}

export function initialStudyValues(
  data: AppData,
  defaults: Record<string, any>,
  record?: Partial<StudySession>,
  preset?: Record<string, unknown>,
): Record<string, any> {
  if (record) return { ...defaults, ...record, ...preset };
  const subjectId = (preset?.subjectId as string | undefined)
    || recentStudySessions(data)[0]?.subjectId || defaults.subjectId;
  const subject = data.subjects.find((s) => s.id === subjectId);
  return {
    ...defaults,
    subjectId,
    stage: subject?.stage || defaults.stage,
    paper: subject?.paper || "",
    // Quick logging should not invent a plan or completed study time.
    plannedMinutes: 0,
    actualMinutes: "",
    ...preset,
    revisionDone: preset?.revisionDone ?? (preset?.activity === "Revision"),
  };
}
