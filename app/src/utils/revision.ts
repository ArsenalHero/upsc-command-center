import type { AppData, Revision } from "../types";
import { addDays, dateKey, uid } from "./date";

export const defaultSpacedRepetition = { enabled: false, days: 7, mode: "preset" as const };
export const presetReviewDays = [1, 7, 14, 30, 90] as const;
export const validRepetitionDays = (days: number) => Number.isInteger(days) && days >= 1 && days <= 365;
export const validPresetStep = (step: number) => Number.isInteger(step) && step >= 0 && step < presetReviewDays.length;

export function completeRevision(
  data: AppData,
  id: string,
  completedDate = dateKey(),
): { completed: boolean; created: boolean; next?: Revision } {
  const revision = data.revisions.find(r => r.id === id);
  if (!revision || revision.completedDate) return { completed: false, created: false };
  const repetition = data.settings.spacedRepetition || defaultSpacedRepetition;
  // Older enabled preferences continue to use the saved custom interval.
  const mode = repetition.mode || "custom";
  if (mode !== "preset" && mode !== "custom") throw new Error("Choose a preset or custom repetition interval.");
  if (revision.repetitionStep !== undefined && !validPresetStep(revision.repetitionStep))
    throw new Error("Invalid preset review step.");
  if (repetition.enabled && !validRepetitionDays(repetition.days))
    throw new Error("Use a whole number from 1 to 365 days for spaced repetition.");

  revision.completedDate = completedDate;
  revision.demo = false;
  const topic = data.topics.find(t => t.id === revision.topicId);
  if (topic) {
    topic.demo = false;
    topic.revisionStage = revision.stage;
    topic.status = "Completed";
    topic.statusHistory.push({ date: completedDate, status: "Completed" });
  }
  if (!repetition.enabled) return { completed: true, created: false };

  const nextStep = mode === "preset" ? (revision.repetitionStep === undefined ? 0 : revision.repetitionStep + 1) : undefined;
  if (nextStep !== undefined && nextStep >= presetReviewDays.length) return { completed: true, created: false };
  const interval = nextStep === undefined ? repetition.days
    : presetReviewDays[nextStep] - (nextStep === 0 ? 0 : presetReviewDays[nextStep - 1]);
  // On-time reviews land on days 1, 7, 14, 30, 90. Late reviews shift subsequent dates forward.
  const dueDate = addDays(completedDate, interval);
  const existing = data.revisions.find(r => r.repeatOf === revision.id)
    || data.revisions.find(r => !r.completedDate && r.subjectId === revision.subjectId && r.topicId === revision.topicId && r.dueDate === dueDate);
  if (existing) {
    if (!existing.repeatOf && existing.repetitionStep === undefined) {
      existing.repeatOf = revision.id;
      if (nextStep !== undefined) existing.repetitionStep = nextStep;
    }
    return { completed: true, created: false, next: existing };
  }

  const next: Revision = {
    id: uid(), subjectId: revision.subjectId, topicId: revision.topicId,
    dueDate, completedDate: "", stage: revision.stage, notes: revision.notes,
    repeatOf: revision.id, demo: false,
    ...(nextStep === undefined ? {} : { repetitionStep: nextStep }),
  };
  data.revisions.push(next);
  return { completed: true, created: true, next };
}
