export type Stage = "Prelims" | "Mains" | "Both" | "Optional" | "CSAT";
export type TopicStatus =
  | "Not Started"
  | "In Progress"
  | "Completed"
  | "Revision Due"
  | "Mastered";
export type RevisionStage =
  | "New topic"
  | "First learning"
  | "Revision 1"
  | "Revision 2"
  | "Revision 3"
  | "PYQ practice"
  | "Test"
  | "Mastered";
export const revisionStages: RevisionStage[] = [
  "New topic",
  "First learning",
  "Revision 1",
  "Revision 2",
  "Revision 3",
  "PYQ practice",
  "Test",
  "Mastered",
];
export const topicStatuses: TopicStatus[] = [
  "Not Started",
  "In Progress",
  "Completed",
  "Revision Due",
  "Mastered",
];
export const studyTypes = [
  "New Learning",
  "Revision",
  "MCQ",
  "PYQ",
  "Answer Writing",
  "Mock Test",
  "Essay",
  "Current Affairs",
  "Notes",
  "Newspaper",
  "Mapping",
  "CSAT",
];
export const errorTypes = [
  "Conceptual",
  "Forgotten Fact",
  "Confused Options",
  "Overthinking",
  "Guessing",
  "Silly Mistake",
  "Misread Question",
  "Current Affairs Gap",
];
export interface Subject {
  id: string;
  name: string;
  stage: Stage;
  paper: string;
  color: string;
  priority: number;
  targetAllocation: number;
}
export interface Topic {
  id: string;
  subjectId: string;
  parentId: string | null;
  name: string;
  status: TopicStatus;
  revisionStage: RevisionStage;
  notes: string;
  importance: number;
  createdAt: string;
  statusHistory: { date: string; status: TopicStatus; demo?: boolean }[];
  demo?: boolean;
}
export interface StudySession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  stage: Stage;
  paper: string;
  subjectId: string;
  topicId: string;
  subtopicId: string;
  resourceId: string;
  activity: string;
  plannedMinutes: number;
  actualMinutes: number;
  questionsPlanned: number;
  questionsAttempted: number;
  correct: number;
  incorrect: number;
  pyqs: number;
  mainsAnswers: number;
  revisionDone: boolean;
  mockScore: number;
  maximumMarks: number;
  focus: number;
  energy: number;
  difficulty: number;
  distractionMinutes: number;
  notes: string;
  problems: string;
  nextRevisionDate: string;
  demo?: boolean;
}
export interface MCQRecord {
  id: string;
  date: string;
  subjectId: string;
  topicId: string;
  stage: Stage;
  difficulty: number;
  seen: number;
  attempted: number;
  correct: number;
  incorrect: number;
  minutes: number;
  errors: Record<string, number>;
  notes: string;
  revisedErrors: number;
  studySessionId?: string;
  demo?: boolean;
}
export interface TestRecord {
  id: string;
  date: string;
  name: string;
  seriesId: string;
  subjectId: string;
  topicId: string;
  stage: Stage;
  score: number;
  maximum: number;
  rank: number;
  attempted: number;
  correct: number;
  strongTopics: string;
  weakTopics: string;
  errors: Record<string, number>;
  notes: string;
  studySessionId?: string;
  demo?: boolean;
}
export interface AnswerRecord {
  id: string;
  date: string;
  paper: string;
  subjectId: string;
  topicId: string;
  question: string;
  marks: number;
  wordLimit: number;
  minutes: number;
  introduction: number;
  body: number;
  conclusion: number;
  examples: boolean;
  data: boolean;
  diagram: boolean;
  articles: boolean;
  reports: boolean;
  score: number;
  notes: string;
  studySessionId?: string;
  demo?: boolean;
}
export interface EssayRecord {
  id: string;
  date: string;
  topic: string;
  category: string;
  words: number;
  minutes: number;
  introduction: number;
  structure: number;
  arguments: number;
  examples: number;
  multidimensionality: number;
  conclusion: number;
  mentorScore: number;
  selfScore: number;
  maximum: number;
  improvements: string;
  demo?: boolean;
}
export interface EthicsRecord {
  id: string;
  date: string;
  topicId: string;
  caseStudy: string;
  minutes: number;
  stakeholders: string;
  dilemma: string;
  alternatives: string;
  justification: string;
  structure: number;
  score: number;
  maximum: number;
  demo?: boolean;
}
export interface CurrentAffair {
  id: string;
  date: string;
  source: string;
  subjectId: string;
  topicId: string;
  title: string;
  prelims: boolean;
  mains: boolean;
  notes: string;
  revised: boolean;
  staticLink: string;
  demo?: boolean;
}
export interface PYQRecord {
  id: string;
  date: string;
  year: number;
  stage: Stage;
  paper: string;
  subjectId: string;
  topicId: string;
  question: string;
  correct: number;
  incorrect: number;
  difficulty: number;
  conceptGap: string;
  revisionNeeded: boolean;
  demo?: boolean;
}
export interface Revision {
  id: string;
  subjectId: string;
  topicId: string;
  dueDate: string;
  completedDate: string;
  stage: RevisionStage;
  notes: string;
  demo?: boolean;
}
export interface Resource {
  id: string;
  name: string;
  subjectId: string;
  topicId: string;
  type: string;
  url: string;
  notes: string;
  demo?: boolean;
}
export interface CatalogItem {
  id: string;
  name: string;
  type: "Activity" | "Course" | "Coaching module" | "Test series" | "Category";
  subjectId: string;
  notes: string;
  demo?: boolean;
}
export interface Goal {
  id: string;
  name: string;
  metric: GoalMetric;
  target: number;
  period: "Daily" | "Weekly" | "Monthly" | "Quarterly" | "Yearly";
  subjectId: string;
  demo?: boolean;
}
export type GoalMetric =
  | "Hours"
  | "MCQs"
  | "Answers"
  | "Essays"
  | "Tests"
  | "Revision"
  | "Optional hours"
  | "CSAT hours"
  | "PYQs"
  | "Syllabus %";
export type WeightKey =
  | "target"
  | "focus"
  | "accuracy"
  | "revision"
  | "questions"
  | "answers";
export interface Settings {
  year: number;
  prelimsDate: string;
  mainsDate: string;
  optional: string;
  dailyHours: number;
  weeklyHours: number;
  monthlyHours: number;
  mcqTarget: number;
  answerTarget: number;
  essayTarget: number;
  revisionTarget: number;
  testTarget: number;
  pyqTarget: number;
  optionalHours: number;
  csatHours: number;
  strengthThreshold: number;
  weaknessThreshold: number;
  minimumSample: number;
  trendThreshold: number;
  allocation: Record<string, number>;
  weights: Record<WeightKey, number>;
  theme: "light" | "dark" | "system";
  setupCompleted: boolean;
}
export interface AppData {
  demoDates?: { prelims: string; mains: string };
  schemaVersion: 1;
  settings: Settings;
  subjects: Subject[];
  topics: Topic[];
  sessions: StudySession[];
  mcqs: MCQRecord[];
  tests: TestRecord[];
  answers: AnswerRecord[];
  essays: EssayRecord[];
  ethics: EthicsRecord[];
  currentAffairs: CurrentAffair[];
  pyqs: PYQRecord[];
  revisions: Revision[];
  resources: Resource[];
  catalog: CatalogItem[];
  goals: Goal[];
}
export type Collection = Exclude<
  keyof AppData,
  "schemaVersion" | "settings" | "demoDates"
>;
export type Entity = AppData[Collection][number];
export interface Filters {
  from: string;
  to: string;
  subjectId: string;
  stage: string;
  paper: string;
  topicId: string;
  activity: string;
  testType: string;
}
export interface Insight {
  id: string;
  kind: "attention" | "improving" | "balance" | "healthy";
  title: string;
  observation: string;
  evidence: string;
  why: string;
  action: string;
  target: string;
  subjectId?: string;
  score: number;
}
