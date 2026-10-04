import originals from "./pyq-bank.json";
import polity from "./polity-bank.json";
import geography from "./geography-bank.json";
import type { PYQQuestion } from "../utils/pyq";

export const originalBank = originals as PYQQuestion[];
export const polityBank = polity as PYQQuestion[];
export const geographyBank = geography as PYQQuestion[];
export const questionBank = [...originalBank, ...polityBank, ...geographyBank];
