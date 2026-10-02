import { useEffect, useRef } from "react";
import { useData } from "../hooks/useData";
import { aggregate } from "../utils/analytics";
import { dateKey, uid } from "../utils/date";
import { fieldSchemas } from "../components/RecordForm";
import { validateEntity, validDate } from "./validation";
import type { StudySession } from "../types";
interface ModelContext {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
}
// Optional browser capability; all actions share the visible UI's data store and validation.
export function WebMCP() {
  const context = useData(),
    ref = useRef(context);
  ref.current = context;
  useEffect(() => {
    const model = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!model) return;
    const controller = new AbortController();
    const register = (tool: Parameters<ModelContext["registerTool"]>[0]) => {
      try {
        Promise.resolve(
          model.registerTool(tool, { signal: controller.signal }),
        ).catch(() => {});
      } catch {
        /* optional capability */
      }
    };
    register({
      name: "read_preparation_summary",
      description:
        "Read study and practice totals for an inclusive date range.",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", format: "date" },
          to: { type: "string", format: "date" },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        const i = input as { from: string; to: string };
        if (!i || !validDate(i.from) || !validDate(i.to) || i.from > i.to)
          throw new Error("Provide a valid inclusive date range.");
        const a = aggregate(ref.current.data, i.from, i.to);
        return {
          hours: a.hours,
          mcqs: a.attempted,
          accuracy: a.accuracy,
          answers: a.answers,
          tests: a.tests,
          revisionHealth: a.revisionHealth,
          syllabus: a.coverage,
        };
      },
    });
    register({
      name: "create_study_session",
      description:
        "Save a new study session to the same local workspace used by the study form.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          subjectId: { type: "string" },
          topicId: { type: "string" },
          minutes: { type: "number", minimum: 0, maximum: 1440 },
          notes: { type: "string" },
        },
        required: ["date", "subjectId", "minutes"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const i = input as {
          date: string;
          subjectId: string;
          topicId?: string;
          minutes: number;
          notes?: string;
        };
        if (
          !i ||
          !validDate(i.date) ||
          typeof i.minutes !== "number" ||
          i.minutes < 0 ||
          i.minutes > 1440
        )
          throw new Error("Invalid session fields.");
        const subject = ref.current.data.subjects.find(
          (s) => s.id === i.subjectId,
        );
        if (!subject) throw new Error("Unknown subject.");
        if (
          i.topicId &&
          !ref.current.data.topics.some(
            (t) => t.id === i.topicId && t.subjectId === subject.id,
          )
        )
          throw new Error("Topic does not belong to this subject.");
        const base: Record<string, any> = { id: uid() };
        fieldSchemas.sessions.forEach(
          (f) =>
            (base[f.key] =
              f.default ??
              (f.type === "number" ? 0 : f.type === "checkbox" ? false : "")),
        );
        const s = {
          ...base,
          date: i.date,
          subjectId: subject.id,
          topicId: i.topicId || "",
          stage: subject.stage,
          paper: subject.paper,
          actualMinutes: i.minutes,
          notes: i.notes || "",
        } as StudySession;
        validateEntity("sessions", s);
        if (!ref.current.saveRecord("sessions", s))
          throw new Error("The session could not be saved.");
        return { id: s.id, saved: true };
      },
    });
    return () => controller.abort();
  }, []);
  return null;
}
