import originals from "./pyq-bank.json";
import polity from "./polity-bank.json";
import geography from "./geography-bank.json";
import additional from "./additional-bank.json";
import duplicates from "./duplicate-groups.json";
import type { PYQQuestion } from "../utils/pyq";
import { buildQuestionCollections } from "../utils/questionCollections";

export const originalBank = originals as PYQQuestion[];
export const polityBank = polity as PYQQuestion[];
export const geographyBank = geography as PYQQuestion[];
export const additionalBank = additional as PYQQuestion[];
export const rawQuestionBank = [...originalBank, ...polityBank, ...geographyBank, ...additionalBank];
const collections = buildQuestionCollections(rawQuestionBank, duplicates);
export const questionBank = collections.questions;
export const questionById = collections.byId;
export const canonicalQuestionId = collections.canonicalId;
export const canonicalRecords = collections.canonicalRecords;
export const latestBankAttempts = collections.latest;
