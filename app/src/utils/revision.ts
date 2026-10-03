import type { AppData, Revision } from "../types";
import { addDays, dateKey, uid } from "./date";

export const defaultSpacedRepetition = { enabled: false, days: 7 };
export const validRepetitionDays = (days: number) => Number.isInteger(days) && days >= 1 && days <= 365;

export function completeRevision(
  data: AppData,
  id: string,
  completedDate = dateKey(),
): { completed: boolean; created: boolean; next?: Revision } {
  const revision = data.revisions.find(r => r.id === id);
  if (!revision || revision.completedDate) return { completed: false, created: false };
  const repetition = data.settings.spacedRepetition || defaultSpacedRepetition;
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

  const dueDate = addDays(completedDate, repetition.days);
  const existing = data.revisions.find(r => r.repeatOf === revision.id)
    || data.revisions.find(r => !r.completedDate && r.subjectId === revision.subjectId && r.topicId === revision.topicId && r.dueDate === dueDate);
  if (existing) return { completed: true, created: false, next: existing };

  const next: Revision = {
    id: uid(), subjectId: revision.subjectId, topicId: revision.topicId,
    dueDate, completedDate: "", stage: revision.stage, notes: revision.notes,
    repeatOf: revision.id, demo: false,
  };
  data.revisions.push(next);
  return { completed: true, created: true, next };
}
