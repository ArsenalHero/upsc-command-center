import type {
  AppData,
  Filters,
  Subject,
  StudySession,
  Goal,
  Insight,
  WeightKey,
} from "../types";
import {
  addDays,
  dateKey,
  dateRange,
  daysBetween,
  inRange,
  periodBounds,
  pct,
  round,
} from "./date";
export const emptyFilters = (): Filters => ({
  from: addDays(dateKey(), -29),
  to: dateKey(),
  subjectId: "",
  stage: "",
  paper: "",
  topicId: "",
  activity: "",
  testType: "",
});
export const matches = (
  r: {
    date?: string;
    subjectId?: string;
    stage?: string;
    paper?: string;
    topicId?: string;
    activity?: string;
  },
  f: Partial<Filters>,
) =>
  (!r.date || ((!f.from || r.date >= f.from) && (!f.to || r.date <= f.to))) &&
  (!f.subjectId || r.subjectId === f.subjectId) &&
  (!f.stage || r.stage === f.stage || r.stage === "Both") &&
  (!f.paper || r.paper === f.paper) &&
  (!f.topicId || r.topicId === f.topicId) &&
  (!f.activity || r.activity === f.activity);
const sum = <T>(a: T[], f: (r: T) => number) => a.reduce((n, r) => n + f(r), 0);
export function coverage(
  data: AppData,
  subjectId = "",
  asOf = "9999-12-31",
): number | null {
  const parentIds = new Set(data.topics.map((t) => t.parentId));
  const leaves = data.topics.filter(
    (t) =>
      (!subjectId || t.subjectId === subjectId) &&
      !parentIds.has(t.id) &&
      t.createdAt <= asOf,
  );
  if (!leaves.length) return null;
  return round(
    (sum(leaves, (t) => {
      const history = t.statusHistory
        .filter((h) => h.date <= asOf)
        .sort((a, b) => a.date.localeCompare(b.date));
      const s = history.at(-1)?.status ?? "Not Started";
      return s === "Completed" || s === "Mastered" || s === "Revision Due"
        ? 1
        : s === "In Progress"
          ? 0.5
          : 0;
    }) /
      leaves.length) *
      100,
  );
}
export function aggregate(
  data: AppData,
  from: string,
  to: string,
  subjectId = "",
  filters: Partial<Filters> = {},
) {
  const f = { ...filters, from, to, ...(subjectId ? { subjectId } : {}) };
  const topicIds = new Set<string>();
  if (f.topicId) {
    topicIds.add(f.topicId);
    let grew = true;
    while (grew) {
      grew = false;
      data.topics.forEach((t) => {
        if (t.parentId && topicIds.has(t.parentId) && !topicIds.has(t.id)) {
          topicIds.add(t.id);
          grew = true;
        }
      });
    }
  }
  const check = (r: any) =>
    matches(r, { ...f, topicId: "" }) &&
    (!f.topicId || topicIds.has(r.topicId) || topicIds.has(r.subtopicId));
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]));
  const sessions = data.sessions.filter(check);
  const linkedMCQs = new Set(
    data.mcqs.map((m) => m.studySessionId).filter(Boolean),
  );
  const linkedAnswers = new Set(
    data.answers.map((m) => m.studySessionId).filter(Boolean),
  );
  const mcqs = data.mcqs.filter((m) => {
    const linked = m.studySessionId
      ? sessionById.get(m.studySessionId)
      : undefined;
    return check({
      ...m,
      paper:
        linked?.paper || data.subjects.find((s) => s.id === m.subjectId)?.paper,
      activity: linked?.activity || (m.stage === "CSAT" ? "CSAT" : "MCQ"),
      subtopicId: linked?.subtopicId,
    });
  });
  const orphanSessions = sessions.filter((s) => !linkedMCQs.has(s.id));
  const attempted =
    sum(mcqs, (m) => m.attempted) +
    sum(orphanSessions, (s) => s.questionsAttempted);
  const correct =
    sum(mcqs, (m) => m.correct) + sum(orphanSessions, (s) => s.correct);
  const incorrect =
    sum(mcqs, (m) => m.incorrect) + sum(orphanSessions, (s) => s.incorrect);
  const answers = data.answers.filter((a) =>
    check({ ...a, stage: "Mains", activity: "Answer Writing" }),
  );
  const tests = data.tests.filter(
    (t) =>
      check({
        ...t,
        paper: data.subjects.find((s) => s.id === t.subjectId)?.paper,
        activity: "Mock Test",
      }) &&
      (!filters.testType || t.seriesId === filters.testType),
  );
  const essays = data.essays.filter((e) =>
    check({ ...e, stage: "Mains", activity: "Essay" }),
  );
  const pyqs = data.pyqs.filter((p) => check({ ...p, activity: "PYQ" }));
  const revisionCheck = (r: AppData["revisions"][number], date: string) => {
    const subject = data.subjects.find((s) => s.id === r.subjectId);
    return check({
      ...r,
      date,
      stage: subject?.stage,
      paper: subject?.paper,
      activity: "Revision",
    });
  };
  const revisions = data.revisions.filter((r) => revisionCheck(r, r.dueDate));
  const due = revisions.filter((r) => r.dueDate <= dateKey()),
    done = due.filter((r) => r.completedDate && r.completedDate <= to),
    onTime = done.filter((r) => r.completedDate <= r.dueDate);
  const completedRevisions = data.revisions.filter(
    (r) => r.completedDate && revisionCheck(r, r.completedDate),
  ).length;
  const hours = round(sum(sessions, (s) => s.actualMinutes) / 60),
    plannedHours = round(sum(sessions, (s) => s.plannedMinutes) / 60);
  const studyDays = new Set(
    sessions.filter((s) => s.actualMinutes > 0).map((s) => s.date),
  ).size;
  const a = {
    hours,
    plannedHours,
    attempted,
    correct,
    incorrect,
    accuracy: pct(correct, attempted),
    answers:
      answers.length +
      sum(
        sessions.filter((s) => !linkedAnswers.has(s.id)),
        (s) => s.mainsAnswers,
      ),
    answerScore: answers.length
      ? round(sum(answers, (a) => (a.score / a.marks) * 100) / answers.length)
      : null,
    answerMinutes: answers.length
      ? round(sum(answers, (a) => a.minutes) / answers.length)
      : null,
    essays: essays.length,
    tests: tests.length,
    testScore: tests.length
      ? round(sum(tests, (t) => (t.score / t.maximum) * 100) / tests.length)
      : null,
    pyqs:
      sum(sessions, (s) => s.pyqs) + sum(pyqs, (p) => p.correct + p.incorrect),
    revisions:
      completedRevisions + sum(sessions, (s) => Number(s.revisionDone)),
    revisionCompletion: pct(done.length, due.length),
    revisionHealth: pct(onTime.length, due.length),
    revisionDue: due.length,
    overdue: due.filter((r) => !r.completedDate && r.dueDate < dateKey())
      .length,
    coverage: coverage(data, subjectId || filters.subjectId, to),
    focus: sessions.length
      ? round(sum(sessions, (s) => s.focus) / sessions.length)
      : null,
    energy: sessions.length
      ? round(sum(sessions, (s) => s.energy) / sessions.length)
      : null,
    distraction: sum(sessions, (s) => s.distractionMinutes),
    optionalHours: round(
      sum(
        sessions.filter(
          (s) =>
            s.stage === "Optional" ||
            data.subjects.find((x) => x.id === s.subjectId)?.stage ===
              "Optional",
        ),
        (s) => s.actualMinutes,
      ) / 60,
    ),
    csatHours: round(
      sum(
        sessions.filter(
          (s) =>
            s.stage === "CSAT" ||
            s.activity === "CSAT" ||
            data.subjects.find((x) => x.id === s.subjectId)?.stage === "CSAT",
        ),
        (s) => s.actualMinutes,
      ) / 60,
    ),
    studyDays,
    averageHours: studyDays ? round(hours / studyDays) : null,
    sessions,
    mcqs,
    testRecords: tests,
    answerRecords: answers,
    essayRecords: essays,
    productivity: null as number | null,
    productivityParts: [] as {
      key: WeightKey;
      label: string;
      value: number;
      weight: number;
    }[],
  };
  const days = Math.max(1, daysBetween(from, to) + 1),
    settings = data.settings;
  const parts = [
    {
      key: "target" as const,
      label: "Hours / daily target",
      value: sessions.length
        ? Math.min(100, (hours / (settings.dailyHours * days)) * 100)
        : null,
    },
    {
      key: "focus" as const,
      label: "Average focus × 10",
      value: a.focus === null ? null : a.focus * 10,
    },
    {
      key: "accuracy" as const,
      label: "Correct / attempted MCQs",
      value: a.accuracy,
    },
    {
      key: "revision" as const,
      label: "Completed / due revisions",
      value: a.revisionCompletion,
    },
    {
      key: "questions" as const,
      label: "MCQs / daily MCQ target",
      value:
        settings.mcqTarget > 0
          ? Math.min(100, (attempted / (settings.mcqTarget * days)) * 100)
          : null,
    },
    {
      key: "answers" as const,
      label: "Answers / daily answer target",
      value:
        settings.answerTarget > 0
          ? Math.min(100, (a.answers / (settings.answerTarget * days)) * 100)
          : null,
    },
  ]
    .filter((p) => p.value !== null)
    .map((p) => ({
      ...p,
      value: round(p.value!),
      weight: settings.weights[p.key],
    }));
  const weights = sum(parts, (p) => p.weight);
  a.productivity =
    (sessions.length || attempted || a.answers || due.length) && weights > 0
      ? round(sum(parts, (p) => p.value * p.weight) / weights)
      : null;
  a.productivityParts = parts;
  return a;
}
export function getStreak(data: AppData, anchor = dateKey()): number {
  const days = new Set(
    data.sessions.filter((s) => s.actualMinutes > 0).map((s) => s.date),
  );
  let day = days.has(anchor) ? anchor : addDays(anchor, -1),
    streak = 0;
  while (days.has(day) && streak < 3660) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}
export function studyTrend(
  data: AppData,
  from: string,
  to: string,
  filters: Partial<Filters> = {},
) {
  const days = dateRange(from, to),
    groups = new Map<
      string,
      {
        actual: number;
        planned: number;
        questions: number;
        answers: number;
        revision: number;
        focus: number;
        count: number;
      }
    >();
  data.sessions
    .filter((s) => matches(s, { ...filters, from, to }))
    .forEach((s) => {
      const v = groups.get(s.date) || {
        actual: 0,
        planned: 0,
        questions: 0,
        answers: 0,
        revision: 0,
        focus: 0,
        count: 0,
      };
      v.actual += s.actualMinutes / 60;
      v.planned += s.plannedMinutes / 60;
      v.questions += s.questionsAttempted;
      v.answers += s.mainsAnswers;
      v.revision += Number(s.revisionDone);
      v.focus += s.focus;
      v.count++;
      groups.set(s.date, v);
    });
  data.mcqs
    .filter((m) => !m.studySessionId && matches(m, { ...filters, from, to }))
    .forEach((m) => {
      const v = groups.get(m.date) || {
        actual: 0,
        planned: 0,
        questions: 0,
        answers: 0,
        revision: 0,
        focus: 0,
        count: 0,
      };
      v.questions += m.attempted;
      groups.set(m.date, v);
    });
  data.answers
    .filter((a) => !a.studySessionId && matches(a, { ...filters, from, to }))
    .forEach((a) => {
      const v = groups.get(a.date) || {
        actual: 0,
        planned: 0,
        questions: 0,
        answers: 0,
        revision: 0,
        focus: 0,
        count: 0,
      };
      v.answers++;
      groups.set(a.date, v);
    });
  return days.map((date) => {
    const g = groups.get(date);
    return {
      date,
      actual: round(g?.actual || 0),
      planned: round(g?.planned || 0),
      questions: g?.questions || 0,
      answers: g?.answers || 0,
      revision: g?.revision || 0,
      productivity: g?.count
        ? round(
            Math.min(
              100,
              (g.actual / data.settings.dailyHours) * 60 +
                (g.focus / g.count) * 4,
            ),
          )
        : 0,
    };
  });
}
export function subjectStats(data: AppData, from: string, to: string) {
  return data.subjects.map((subject) => {
    const a = aggregate(data, from, to, subject.id);
    const measures = [
      a.coverage,
      a.revisionCompletion,
      a.attempted >= data.settings.minimumSample ? a.accuracy : null,
      a.testScore,
      a.answerScore,
    ];
    const measured = measures.filter((v): v is number => v !== null);
    const low = measured.filter(
      (v) => v < data.settings.weaknessThreshold,
    ).length;
    const strong = measured.filter(
      (v) => v >= data.settings.strengthThreshold,
    ).length;
    const status =
      measured.length < 2
        ? "Needs data"
        : low >= 2
          ? "Weak"
          : strong >= Math.ceil(measured.length * 0.7)
            ? "Strong"
            : "Needs attention";
    const lastStudied =
      data.sessions
        .filter((s) => s.subjectId === subject.id && s.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date))
        .at(-1)?.date || "";
    return {
      ...a,
      subject,
      status,
      lastStudied,
      health:
        measured.length >= 2
          ? round(sum(measured, (v) => v) / measured.length)
          : null,
    };
  });
}
export function allocationCategory(data: AppData, s: StudySession): string {
  const subject = data.subjects.find((x) => x.id === s.subjectId);
  if (
    s.activity in data.settings.allocation &&
    ![
      "Revision",
      "Answer Writing",
      "PYQs",
      "Tests",
      "Current Affairs",
      "CSAT",
    ].includes(s.activity)
  )
    return s.activity;
  if (subject && subject.name in data.settings.allocation) return subject.name;
  if (s.stage === "Optional" || subject?.stage === "Optional")
    return "Optional";
  if (s.stage === "CSAT" || s.activity === "CSAT" || subject?.stage === "CSAT")
    return "CSAT";
  if (
    ["Current Affairs", "Newspaper"].includes(s.activity) ||
    subject?.paper === "Current Affairs"
  )
    return "Current Affairs";
  if (s.activity === "Revision") return "Revision";
  if (s.activity === "Answer Writing") return "Answer Writing";
  if (s.activity === "Mock Test") return "Tests";
  if (s.activity === "PYQ") return "PYQs";
  return "GS";
}
export function balance(data: AppData, sessions: StudySession[]) {
  const total = sum(sessions, (s) => s.actualMinutes);
  return Object.entries(data.settings.allocation).map(([name, target]) => ({
    name,
    target,
    actual: total
      ? round(
          (sum(
            sessions.filter((s) => allocationCategory(data, s) === name),
            (s) => s.actualMinutes,
          ) /
            total) *
            100,
        )
      : 0,
  }));
}
export function goalValue(data: AppData, goal: Goal, anchor = dateKey()) {
  const [from, to] = periodBounds(goal.period, anchor);
  const a = aggregate(data, from, to, goal.subjectId);
  const values = {
    Hours: a.hours,
    MCQs: a.attempted,
    Answers: a.answers,
    Essays: a.essays,
    Tests: a.tests,
    Revision: a.revisions,
    "Optional hours": a.optionalHours,
    "CSAT hours": a.csatHours,
    PYQs: a.pyqs,
    "Syllabus %": a.coverage ?? 0,
  };
  return {
    value: values[goal.metric],
    progress: Math.min(100, (values[goal.metric] / goal.target) * 100),
    from,
    to,
  };
}
export function insights(data: AppData, from: string, to: string): Insight[] {
  if (!data.sessions.length && !data.mcqs.length && !data.revisions.length)
    return [];
  const current = aggregate(data, from, to),
    duration = daysBetween(from, to) + 1,
    previous = aggregate(data, addDays(from, -duration), addDays(from, -1)),
    stats = subjectStats(data, from, to);
  const result: Insight[] = [];
  stats.forEach((s) => {
    const old = aggregate(
      data,
      addDays(from, -duration),
      addDays(from, -1),
      s.subject.id,
    );
    const sample = s.attempted >= data.settings.minimumSample;
    const lowAccuracy =
      sample &&
      s.accuracy !== null &&
      s.accuracy < data.settings.strengthThreshold;
    if (s.overdue || (lowAccuracy && s.status !== "Strong"))
      result.push({
        id: "subject-" + s.subject.id,
        kind: "attention",
        title: s.subject.name,
        observation: `${s.overdue ? `${s.overdue} overdue revision${s.overdue === 1 ? "" : "s"}` : ""}${s.overdue && sample ? " · " : ""}${sample ? `${s.accuracy}% MCQ accuracy` : ""}.`,
        evidence: `${s.correct}/${s.attempted} MCQs correct; ${s.overdue} overdue revisions; coverage ${s.coverage ?? "unavailable"}%. Overall accuracy: ${current.accuracy ?? "unavailable"}%.`,
        why: "Recall and practice performance together reveal gaps more reliably than study time alone.",
        action: s.overdue
          ? "Complete the overdue revisions, then review topic-wise errors in a timed question set."
          : "Review the largest error categories and attempt a focused set before adding new material.",
        target: `Complete ${s.overdue || 1} revision${s.overdue === 1 ? "" : "s"} and reach your ${data.settings.strengthThreshold}% threshold over the next ${Math.max(50, data.settings.minimumSample)} MCQs.`,
        subjectId: s.subject.id,
        score: round(
          s.subject.priority * 15 +
            s.overdue * 5 +
            (s.accuracy !== null ? 100 - s.accuracy : 0),
        ),
      });
    if (
      s.coverage !== null &&
      s.coverage < data.settings.weaknessThreshold &&
      s.subject.priority >= 3 &&
      !s.overdue &&
      !lowAccuracy
    ) {
      const pending = data.topics
        .filter(
          (t) =>
            t.subjectId === s.subject.id &&
            ["Not Started", "In Progress"].includes(t.status) &&
            !data.topics.some((child) => child.parentId === t.id),
        )
        .sort((a, b) => b.importance - a.importance)[0];
      if (pending)
        result.push({
          id: "coverage-" + s.subject.id,
          kind: "balance",
          title: `Build ${s.subject.name} coverage`,
          observation: `${s.coverage}% syllabus coverage; ${pending.name} is ${pending.status.toLowerCase()}.`,
          evidence: `Leaf-topic completion: ${s.coverage}%. Subject importance: ${s.subject.priority}/5; topic importance: ${pending.importance}/5.`,
          why: "An incomplete high-priority syllabus section needs a concrete learning and revision plan.",
          action: `Schedule a learning block for ${pending.name}, update its status, and set a recall date.`,
          target: `Move ${pending.name} to Completed and schedule its first revision.`,
          subjectId: s.subject.id,
          score: round(s.subject.priority * 10 + (100 - s.coverage) * 0.3),
        });
    }
    if (
      sample &&
      old.attempted >= data.settings.minimumSample &&
      old.accuracy !== null &&
      s.accuracy !== null &&
      s.accuracy - old.accuracy >= data.settings.trendThreshold
    )
      result.push({
        id: "improving-" + s.subject.id,
        kind: "improving",
        title: `${s.subject.name} is improving`,
        observation: `Accuracy increased from ${old.accuracy}% to ${s.accuracy}%.`,
        evidence: `Previous period: ${old.correct}/${old.attempted}. Current period: ${s.correct}/${s.attempted}. Change: +${round(s.accuracy - old.accuracy)} percentage points.`,
        why: "The change exceeds your configured trend threshold; keep checking it against a meaningful practice sample.",
        action:
          "Maintain the current practice cadence and review recurring errors.",
        target: `Maintain at least ${data.settings.strengthThreshold}% accuracy over the next ${Math.max(50, data.settings.minimumSample)} questions.`,
        subjectId: s.subject.id,
        score: 25,
      });
    if (!s.hours && s.subject.priority >= 4)
      result.push({
        id: "neglect-" + s.subject.id,
        kind: "balance",
        title: `Schedule ${s.subject.name}`,
        observation: "No study sessions in this period.",
        evidence: `User priority: ${s.subject.priority}/5. Last studied: ${s.lastStudied || "not recorded"}. Coverage: ${s.coverage ?? "unavailable"}%.`,
        why: "This is an activity gap for a high-priority subject, not a judgement of your subject knowledge.",
        action:
          "Reserve a focused study block and choose an incomplete or overdue topic.",
        target: "Log one 45-minute session this week.",
        subjectId: s.subject.id,
        score: s.subject.priority * 12,
      });
  });
  const studyDates = [
    ...new Set(
      data.sessions
        .filter((s) => s.date <= to && s.actualMinutes > 0)
        .map((s) => s.date),
    ),
  ]
    .sort()
    .reverse();
  const csatDates = new Set(
    data.sessions
      .filter(
        (s) =>
          s.stage === "CSAT" ||
          s.activity === "CSAT" ||
          data.subjects.find((x) => x.id === s.subjectId)?.stage === "CSAT",
      )
      .map((s) => s.date),
  );
  data.mcqs
    .filter(
      (m) =>
        m.stage === "CSAT" ||
        data.subjects.find((s) => s.id === m.subjectId)?.stage === "CSAT",
    )
    .forEach((m) => csatDates.add(m.date));
  let neglect = 0;
  for (const date of studyDates) {
    if (csatDates.has(date)) break;
    neglect++;
  }
  if (neglect >= 5)
    result.push({
      id: "csat-neglect",
      kind: "attention",
      title: "CSAT practice needs a slot",
      observation: `No CSAT practice during the last ${neglect} study days.`,
      evidence: `The most recent ${neglect} dates with study sessions contain no CSAT session or question set.`,
      why: "Consistent practice helps you monitor a separate part of your preparation.",
      action:
        "Schedule a timed comprehension or reasoning set and review each wrong answer.",
      target: `Record ${data.settings.csatHours} hours of CSAT practice this week.`,
      score: 125,
    });
  const allocation = balance(data, current.sessions).find(
    (b) => b.name === "Optional",
  );
  if (
    allocation &&
    current.hours > 0 &&
    allocation.actual < allocation.target * 0.7
  )
    result.push({
      id: "optional-balance",
      kind: "balance",
      title: "Protect your Optional time",
      observation: `${allocation.actual}% of study time versus a ${allocation.target}% target.`,
      evidence: `${current.optionalHours} Optional hours out of ${current.hours} total hours in this period.`,
      why: "An allocation gap shows that your plan and recorded activity are drifting apart.",
      action:
        "Book two Optional blocks and attach each to a topic and revision date.",
      target: `Bring Optional allocation toward ${allocation.target}%.`,
      score: 95,
    });
  const upcoming = data.tests
    .filter((t) => t.date > to && t.date <= addDays(to, 7))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (upcoming)
    result.push({
      id: "upcoming-test",
      kind: "balance",
      title: `Prepare for ${upcoming.name}`,
      observation: `Scheduled on ${upcoming.date}.`,
      evidence: `Upcoming ${upcoming.stage} test; subject ${data.subjects.find((s) => s.id === upcoming.subjectId)?.name || "all subjects"}.`,
      why: "A near-term test gives your revision a concrete deadline.",
      action:
        "Revise the relevant weak topics and review the last test errors.",
      target: "Finish one focused revision block before the test.",
      score: 110,
      subjectId: upcoming.subjectId,
    });
  if (
    current.accuracy !== null &&
    previous.accuracy !== null &&
    current.accuracy - previous.accuracy >= data.settings.trendThreshold
  )
    result.push({
      id: "overall-accuracy",
      kind: "improving",
      title: "Your accuracy is trending up",
      observation: `${previous.accuracy}% → ${current.accuracy}%`,
      evidence: `${previous.attempted} questions in the previous period; ${current.attempted} in this period.`,
      why: "A sustained increase with sufficient practice indicates fewer errors across the measured questions.",
      action: "Keep your error review routine consistent.",
      target: "Maintain the improvement in the next comparison period.",
      score: 20,
    });
  return result.sort((a, b) => b.score - a.score);
}
export function errorSummary(data: AppData, filters: Partial<Filters>) {
  const records = data.mcqs.filter((m) => matches(m, filters));
  const map = new Map<string, number>();
  records.forEach((m) =>
    Object.entries(m.errors).forEach(([name, n]) =>
      map.set(name, (map.get(name) || 0) + n),
    ),
  );
  return [...map]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
export function topicStats(data: AppData, from: string, to: string) {
  return data.topics
    .filter((t) => !data.topics.some((c) => c.parentId === t.id))
    .map((t) => {
      const a = aggregate(data, from, to, t.subjectId, { topicId: t.id });
      const recent = a.sessions.at(-1)?.date;
      return {
        topic: t,
        subject: data.subjects.find((s) => s.id === t.subjectId)!,
        ...a,
        recency: recent ? Math.max(0, 100 - daysBetween(recent, to) * 3) : null,
      };
    });
}
