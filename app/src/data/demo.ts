import type { AppData, StudySession, MCQRecord } from "../types";
import { revisionStages, errorTypes } from "../types";
import { createEmptyData } from "./defaults";
import { dateKey, addDays, round } from "../utils/date";
export function createDemoData(): AppData {
  const data = createEmptyData(),
    today = dateKey();
  let seed = 4207;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  data.settings.setupCompleted = true;
  data.settings.prelimsDate = addDays(today, 235);
  data.settings.mainsDate = addDays(today, 320);
  data.demoDates = {
    prelims: data.settings.prelimsDate,
    mains: data.settings.mainsDate,
  };
  data.subjects[13].name = "Sociology";
  const optionalNames = [
    "Sociology as a discipline",
    "Sociological thinkers",
    "Research methods",
    "Social stratification",
    "Indian society",
    "Social change",
    "Rural society",
    "Social movements",
  ];
  let op = 0;
  data.topics
    .filter((t) => t.id.endsWith("-topic"))
    .forEach((t) => (t.name = optionalNames[op++]));
  data.topics.forEach((t, i) => {
    t.demo = true;
    t.createdAt = addDays(today, -180);
    const probability =
      t.subjectId === "subject-5"
        ? 0.47
        : t.subjectId === "subject-13"
          ? 0.41
          : 0.7;
    t.status =
      rand() < probability
        ? rand() < 0.25
          ? "Mastered"
          : "Completed"
        : rand() < 0.55
          ? "In Progress"
          : "Not Started";
    t.statusHistory = [
      { date: addDays(today, -180), status: "Not Started", demo: true },
    ];
    if (t.status !== "Not Started")
      t.statusHistory.push({
        date: addDays(today, -100 + Math.floor(rand() * 90)),
        status: "In Progress",
        demo: true,
      });
    if (t.status === "Completed" || t.status === "Mastered")
      t.statusHistory.push({
        date: addDays(today, -70 + Math.floor(rand() * 65)),
        status: t.status,
        demo: true,
      });
    t.revisionStage =
      t.status === "Mastered"
        ? "Mastered"
        : t.status === "Completed"
          ? pick(revisionStages.slice(2, 7))
          : t.status === "In Progress"
            ? "First learning"
            : "New topic";
    t.notes =
      i % 5 === 0
        ? "Connect the static concepts to recent examples. Review PYQ themes before the next practice set."
        : "";
  });
  const resources = [
    ["Indian Polity · M. Laxmikanth", "subject-3"],
    ["Modern India · Spectrum", "subject-0"],
    ["Indian Economy · Class notes", "subject-4"],
    ["Environment · Shankar IAS", "subject-5"],
    ["The Hindu · Daily notes", "subject-7"],
    ["Sociology · Paper I notes", "subject-13"],
    ["CSAT · Practice workbook", "subject-12"],
  ];
  data.resources = resources.map(([name, subjectId], i) => ({
    id: `demo-resource-${i}`,
    name,
    subjectId,
    topicId: "",
    type: "Book",
    url: "",
    notes: "Fictional demo resource entry.",
    demo: true,
  }));
  data.catalog = [
    {
      id: "demo-series",
      name: "GS Foundation test series",
      type: "Test series",
      subjectId: "",
      notes: "Fictional demo series",
      demo: true,
    },
  ];
  const weighted = [
    0, 0, 2, 3, 3, 3, 4, 4, 5, 6, 7, 7, 8, 9, 10, 11, 12, 13, 13,
  ];
  for (let day = -179; day <= 0; day++) {
    if (day < 0 && rand() < 0.11) continue;
    const count = day === 0 ? 4 : 3 + Math.floor(rand() * 2);
    let start = 7 * 60;
    for (let k = 0; k < count; k++) {
      let si = pick(weighted);
      if (day > -9 && si === 12) si = 5;
      if (day === 0) si = [3, 7, 13, 5][k];
      const subject = data.subjects[si],
        topic = pick(
          data.topics.filter(
            (t) =>
              t.subjectId === subject.id &&
              !data.topics.some((x) => x.parentId === t.id),
          ),
        );
      const activity =
        si === 12
          ? "CSAT"
          : k === count - 1
            ? pick(["MCQ", "Revision", "PYQ", "Answer Writing"])
            : si === 7
              ? "Current Affairs"
              : "New Learning";
      const actual =
        day === 0 ? [110, 45, 100, 60][k] : Math.round(60 + rand() * 85);
      const questions = ["MCQ", "CSAT", "PYQ"].includes(activity)
        ? 20 + Math.floor(rand() * 35)
        : 0;
      const accuracy =
        si === 5
          ? 0.5 + rand() * 0.13
          : si === 3
            ? 0.65 + ((day + 180) / 180) * 0.16 + rand() * 0.08
            : 0.58 + rand() * 0.2;
      const correct = Math.round(questions * accuracy);
      const time = (n: number) =>
        `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
      const s: StudySession = {
        id: `demo-session-${day}-${k}`,
        date: addDays(today, day),
        startTime: time(start),
        endTime: time(start + actual),
        stage:
          si === 13
            ? "Optional"
            : si === 12
              ? "CSAT"
              : si >= 8
                ? "Mains"
                : k === count - 1
                  ? "Prelims"
                  : "Both",
        paper: subject.paper,
        subjectId: subject.id,
        topicId: topic.id,
        subtopicId: "",
        resourceId:
          data.resources.find((r) => r.subjectId === subject.id)?.id || "",
        activity,
        plannedMinutes: 120,
        actualMinutes: actual,
        questionsPlanned: questions ? 50 : 0,
        questionsAttempted: questions,
        correct,
        incorrect: questions - correct,
        pyqs: activity === "PYQ" ? questions : 0,
        mainsAnswers: activity === "Answer Writing" ? 2 : 0,
        revisionDone: activity === "Revision",
        mockScore: 0,
        maximumMarks: 200,
        focus: Math.min(10, Math.round(6 + rand() * 3)),
        energy: Math.round(5 + rand() * 4),
        difficulty: Math.round(2 + rand() * 2),
        distractionMinutes: Math.floor(rand() * 14),
        notes: pick([
          "Reviewed key ideas and updated short notes.",
          "Connected the topic to recent PYQs.",
          "Timed practice with error review.",
          "Recalled key concepts without referring to notes.",
        ]),
        problems: si === 5 ? "Confusion between closely related concepts." : "",
        nextRevisionDate: "",
        demo: true,
      };
      data.sessions.push(s);
      start += actual + 45;
      if (questions) {
        const wrong = questions - correct;
        const conceptual = Math.floor(wrong * 0.48);
        const mcq: MCQRecord = {
          id: s.id + "-mcq",
          date: s.date,
          subjectId: s.subjectId,
          topicId: s.topicId,
          stage: s.stage,
          difficulty: s.difficulty,
          seen: questions + 5,
          attempted: questions,
          correct,
          incorrect: wrong,
          minutes: actual,
          errors: {
            Conceptual: conceptual,
            "Forgotten Fact": wrong - conceptual,
          },
          notes: s.notes,
          revisedErrors: Math.floor(wrong * 0.6),
          studySessionId: s.id,
          demo: true,
        };
        data.mcqs.push(mcq);
      }
    }
  }
  for (let i = 0; i < 24; i++) {
    const date = addDays(today, -168 + i * 7),
      score = round(90 + i * 1.75 + (rand() - 0.5) * 15);
    data.tests.push({
      id: `demo-test-${i}`,
      date,
      name: `GS full-length test ${i + 1}`,
      seriesId: "demo-series",
      subjectId: pick(data.subjects.slice(0, 7)).id,
      topicId: "",
      stage: "Prelims",
      score,
      maximum: 200,
      rank: 0,
      attempted: 85,
      correct: Math.round(score / 2 + 10),
      strongTopics: "Constitution, Modern History",
      weakTopics: "Biodiversity, Monetary Policy",
      errors: { Conceptual: 8, "Forgotten Fact": 5, "Confused Options": 4 },
      notes: "Review the flagged questions before the next test.",
      demo: true,
    });
  }
  for (let i = 0; i < 82; i++) {
    const subject = pick(data.subjects.slice(8, 12)),
      topic = pick(data.topics.filter((t) => t.subjectId === subject.id));
    data.answers.push({
      id: `demo-answer-${i}`,
      date: addDays(today, -Math.floor(rand() * 160)),
      paper: subject.paper,
      subjectId: subject.id,
      topicId: topic.id,
      question: `Discuss the key challenges related to ${topic.name.toLowerCase()} with suitable examples.`,
      marks: 10,
      wordLimit: 150,
      minutes: round(8 + rand() * 8),
      introduction: 3,
      body: 4,
      conclusion: 3,
      examples: true,
      data: rand() > 0.4,
      diagram: rand() > 0.6,
      articles: rand() > 0.6,
      reports: rand() > 0.5,
      score: round(4 + rand() * 4),
      notes: "Use a more specific example and tighten the conclusion.",
      demo: true,
    });
  }
  for (let i = 0; i < 14; i++)
    data.essays.push({
      id: `demo-essay-${i}`,
      date: addDays(today, -161 + i * 12),
      topic: pick([
        "Technology and the human condition",
        "Education is the foundation of an equitable society",
        "The future of democracy lies in participation",
        "Growth must be inclusive to be sustainable",
      ]),
      category: pick(["Philosophical", "Social", "Governance"]),
      words: 1100 + Math.floor(rand() * 150),
      minutes: 85 + Math.floor(rand() * 15),
      introduction: 3,
      structure: 4,
      arguments: 4,
      examples: 3,
      multidimensionality: 3,
      conclusion: 4,
      mentorScore: round(62 + i * 1.1 + rand() * 8),
      selfScore: round(65 + i * 0.8),
      maximum: 125,
      improvements:
        "Develop the counterargument and add a relevant contemporary example.",
      demo: true,
    });
  for (let i = 0; i < 80; i++) {
    const subject = pick(data.subjects.filter((s) => s.stage !== "CSAT")),
      topic = pick(data.topics.filter((t) => t.subjectId === subject.id));
    const dueDate = addDays(today, -60 + Math.floor(rand() * 74));
    const completedDate =
      dueDate <= today && rand() > 0.27
        ? addDays(dueDate, Math.floor(rand() * 4) - 2)
        : "";
    data.revisions.push({
      id: `demo-rev-${i}`,
      subjectId: subject.id,
      topicId: topic.id,
      dueDate,
      completedDate,
      stage: pick(revisionStages.slice(2, 5)),
      notes: "Recall, check gaps, then practise five PYQs.",
      demo: true,
    });
  }
  // Ensure the demo has concrete upcoming and overdue priorities.
  data.revisions.push({
    id: "demo-rev-biodiversity",
    subjectId: "subject-5",
    topicId: "topic-5-2",
    dueDate: addDays(today, -5),
    completedDate: "",
    stage: "Revision 2",
    notes: "Protected-area categories and species distribution.",
    demo: true,
  });
  for (let i = 0; i < 36; i++) {
    const subject = pick(data.subjects.slice(0, 8)),
      topic = pick(data.topics.filter((t) => t.subjectId === subject.id));
    data.pyqs.push({
      id: `demo-pyq-${i}`,
      date: addDays(today, -Math.floor(rand() * 140)),
      year: 2014 + Math.floor(rand() * 12),
      stage: "Prelims",
      paper: "GS-I",
      subjectId: subject.id,
      topicId: topic.id,
      question: `Past question on ${topic.name}`,
      correct: Math.round(rand() * 4),
      incorrect: Math.round(rand() * 2),
      difficulty: 3,
      conceptGap: rand() > 0.6 ? "Revisit the underlying static concept." : "",
      revisionNeeded: rand() > 0.6,
      demo: true,
    });
  }
  for (let i = 0; i < 25; i++) {
    const subject = pick(data.subjects.slice(0, 8)),
      topic = pick(data.topics.filter((t) => t.subjectId === subject.id));
    data.currentAffairs.push({
      id: `demo-ca-${i}`,
      date: addDays(today, -i * 3),
      source: "Daily newspaper notes",
      subjectId: subject.id,
      topicId: topic.id,
      title: pick([
        "Policy update: key provisions and implications",
        "New report: trends and indicators",
        "Conservation initiative: static connections",
        "Governance reform: challenges and way forward",
      ]),
      prelims: true,
      mains: true,
      notes:
        "Fictional demonstration note. Add the specific source and factual details in your own entries.",
      revised: rand() > 0.6,
      staticLink: topic.name,
      demo: true,
    });
  }
  for (let i = 0; i < 8; i++)
    data.ethics.push({
      id: `demo-ethics-${i}`,
      date: addDays(today, -i * 10),
      topicId: "topic-11-6",
      caseStudy:
        "A public official faces competing demands of transparency and confidentiality.",
      minutes: 22,
      stakeholders: "Citizens, public official, institution",
      dilemma: "Transparency versus confidentiality",
      alternatives:
        "Disclosure within lawful limits; seek guidance; document the decision.",
      justification: "Proportionality, public interest, accountability.",
      structure: 4,
      score: round(9 + rand() * 6),
      maximum: 20,
      demo: true,
    });
  return data;
}
