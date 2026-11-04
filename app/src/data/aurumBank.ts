import { questionBank } from "./questionBank";
import { aurumPYQs } from "../utils/aurum";

// Lazy-loaded only on the Aurum screen; reuse the reviewed, canonical PYQ bank.
let bank: ReturnType<typeof aurumPYQs> | undefined;
export const loadAurumPYQs = () => bank ||= aurumPYQs(questionBank);
