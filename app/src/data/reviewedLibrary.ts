import { questionBank } from "./questionBank";
import type { PYQQuestion } from "../utils/pyq";

// Imported matches require identical question wording, choice text and choice letters.
// Overlay corrections in the reading library without changing the original HTML data.
const correctedEntries = new Map<string, PYQQuestion>();
for (const q of questionBank) {
  if (!q.explanationReview?.preferReviewedExplanation && q.explanationReview?.status !== "disputed") continue;
  for (const id of q.suppliedExplanationIds || []) {
    const previous = correctedEntries.get(id);
    if (!previous || q.keyStatus === "official") correctedEntries.set(id, q);
  }
}
export const reviewedLibraryQuestion = (id: string) => correctedEntries.get(id);
