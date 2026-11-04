import type { PYQQuestion, StudyExplanation } from "./pyq";

export type AurumSource = "pyq" | "mock" | "both";
export type AurumQuestion = {
  id: string; origin: "pyq" | "mock"; sourceId: string; sourceLabel: string;
  fingerprint?: string; testId?: string; question: string; subject: string; topic: string;
  options: Record<string, string>; correct?: string; explanation?: string | StudyExplanation;
  blocks?: PYQQuestion["blocks"]; sourceImage?: string; sourceImageAlt?: string; sourceUrl?: string;
};
export type AurumCandidate = {
  origin: "pyq" | "mock"; sourceId: string; testId?: string; fingerprint: string;
  subject: string; subjects: string[]; sourceLabel: string; question?: AurumQuestion;
};
export type AurumAnswer = { option: string; outcome: "correct" | "incorrect" | "skipped" };
export type AurumSession = {
  id: string; source: AurumSource; subjects: string[]; status: "running" | "completed";
  startedAt: string; completedAt?: string; questions: AurumQuestion[]; answers: Record<string, AurumAnswer>;
  summary: { total: number; answered: number; correct: number; incorrect: number; skipped: number };
};
export type AurumState = {
  seen: string[]; seenIds: string[]; mocks: AurumCandidate[]; active: AurumSession | null; latest: AurumSession | null;
  completed: number; practised: number;
};
export type AurumPreview = Omit<AurumSession, "questions" | "answers">;
export type AurumCatalog = {
  source: AurumSource; selected: string[]; available: number;
  sources: Record<AurumSource, number>;
  subjects: ({ name: string } & Record<AurumSource, number>)[];
  active: AurumPreview | null; latest: AurumPreview | null; completed: number; practised: number;
};
export const aurumSources: { id: AurumSource; label: string; description: string }[] = [
  { id: "pyq", label: "PYQs", description: "Previous year questions" },
  { id: "mock", label: "Mock test questions", description: "From Golden Gate mocks" },
  { id: "both", label: "Both", description: "A mix of PYQs and mocks" },
];

export function aurumSubject(value: string) {
  const aliases: Record<string, string> = {
    "economics": "Economy", "polity & governance": "Polity", "art and culture": "Art & Culture",
    "science and technology": "Science & Technology", "science and tech": "Science & Technology",
  };
  return aliases[value.trim().toLowerCase()] || value.trim();
}

// The server uses exactly this normalization. Option order, punctuation and
// whitespace do not give the same question a fresh identity in another source.
export function aurumIdentity(q: Pick<AurumQuestion, "question" | "options">) {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean(q.question) + "|" + Object.values(q.options).map(clean).sort().join("|");
}
export async function aurumFingerprint(q: Pick<AurumQuestion, "question" | "options">) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(aurumIdentity(q)));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
export async function aurumPYQs(bank: PYQQuestion[]): Promise<AurumCandidate[]> {
  return Promise.all(bank.filter(q => (q.stage !== "Mains" || q.questionType === "MCQ") &&
    !!q.answer && !!q.options[q.answer] && q.keyStatus !== "dropped" && q.keyStatus !== "pending")
    .map(async q => ({
      origin: "pyq" as const, sourceId: q.id, fingerprint: await aurumFingerprint(q), subject: aurumSubject(q.subject),
      subjects: [...new Set([q.subject, ...(q.subjectMemberships || []).map(s => s.subject)].map(aurumSubject))],
      sourceLabel: q.sourceTitle || `${q.year} · ${q.paper} · Q${q.number}`,
      question: {
        id: q.id, sourceId: q.id, origin: "pyq" as const, sourceLabel: q.sourceTitle || `${q.year} · ${q.paper} · Q${q.number}`,
        question: q.question, options: q.options, correct: q.answer!, subject: aurumSubject(q.subject), topic: q.topic,
        explanation: q.explanationReview?.explanation || q.explanation,
        blocks: q.blocks, sourceImage: q.sourceImage, sourceImageAlt: q.sourceImageAlt, sourceUrl: q.sourceUrl,
      },
    })));
}

export function aurumPool(candidates: AurumCandidate[], seen: string[], source: AurumSource, subjects: string[] = []) {
  const used = new Set(seen), selected = new Set(subjects);
  return candidates.filter(q => !used.has(q.fingerprint) && !used.has(`id:${q.origin}:${q.sourceId}`) && (source === "both" || q.origin === source) &&
    (!selected.size || q.subjects.some(s => selected.has(s))));
}
export const aurumCount = (questions: AurumCandidate[]) => new Set(questions.map(q => q.fingerprint)).size;

export function chooseAurumQuestions(pool: AurumCandidate[], count: number, source: AurumSource, random = Math.random) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw Error("Choose a whole number from 1 to 100.");
  if (count > aurumCount(pool)) throw Error("There aren’t enough fresh questions. Lower the count or add subjects.");
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosen: AurumCandidate[] = [], used = new Set<string>();
  const add = (q: AurumCandidate | undefined) => {
    if (q && !used.has(q.fingerprint) && chosen.length < count) { chosen.push(q); used.add(q.fingerprint); }
  };
  // A mixed set includes each source when two distinct questions are available.
  if (source === "both" && count >= 2) {
    const pyq = shuffled.find(q => q.origin === "pyq" && shuffled.some(m => m.origin === "mock" && m.fingerprint !== q.fingerprint));
    if (pyq) { add(pyq); add(shuffled.find(q => q.origin === "mock" && !used.has(q.fingerprint))); }
  }
  for (const q of shuffled) add(q);
  return chosen.map(q => q.origin === "mock"
    ? { origin: q.origin, testId: q.testId, sourceId: q.sourceId }
    : { ...q.question, subjects: q.subjects });
}
