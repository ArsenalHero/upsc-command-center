import part1 from "./supplied-explanations-1-bank.json";
import part2 from "./supplied-explanations-2-bank.json";
import part3 from "./supplied-explanations-3-bank.json";
import part4 from "./supplied-explanations-4-bank.json";
import part5 from "./supplied-explanations-5-bank.json";
import part6 from "./supplied-explanations-6-bank.json";
import part7 from "./supplied-explanations-7-bank.json";
import part8 from "./supplied-explanations-8-bank.json";
import part9 from "./supplied-explanations-9-bank.json";
import type { PYQQuestion } from "../utils/pyq";

export interface SuppliedExplanation {
  id: string; n: number; exam: string; year: string; subject: string; studySubject: string; topic: string;
  question: string; questionText: string; options: [string, string][]; answer: string; explanation: string;
}
export const suppliedExplanations = [...part1, ...part2, ...part3, ...part4, ...part5, ...part6, ...part7, ...part8, ...part9] as unknown as SuppliedExplanation[];
const byId = new Map(suppliedExplanations.map(entry => [entry.id, entry]));
export const suppliedExplanationsFor = (q: PYQQuestion) => (q.suppliedExplanationIds || []).map(id => byId.get(id)).filter((entry): entry is SuppliedExplanation => !!entry);
