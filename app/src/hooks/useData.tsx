import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  AppData,
  Collection,
  Entity,
  Settings,
  StudySession,
  PYQRecord,
  PYQDraft,
} from "../types";
import {
  LocalStorageRepository,
  type DataRepository,
} from "../services/repository";
import {
  validateData,
  validateEntity,
  validatePYQDraft,
} from "../services/validation";
import { createEmptyData } from "../data/defaults";
import { createDemoData } from "../data/demo";
import { dateKey, uid } from "../utils/date";
const guestRepository = new LocalStorageRepository();
interface Editor {
  collection: Collection;
  record?: Entity;
  preset?: Record<string, unknown>;
}
interface DataContextValue {
  data: AppData;
  error: string;
  toast: string;
  editor: Editor | null;
  setEditor: (e: Editor | null) => void;
  notify: (text: string) => void;
  saveRecord: (c: Collection, r: Entity) => boolean;
  deleteRecord: (c: Collection, id: string) => void;
  updateSettings: (s: Settings) => boolean;
  replaceData: (d: AppData) => void;
  loadDemo: () => void;
  clearDemo: () => void;
  reset: () => void;
  markRevision: (id: string) => void;
  setTopicStatus: (id: string, status: import("../types").TopicStatus) => void;
  savePYQDraft: (draft: PYQDraft | undefined) => boolean;
  submitPYQ: (record: PYQRecord, nextDraft: PYQDraft) => boolean;
}
const Context = createContext<DataContextValue | null>(null);
export function DataProvider({
  children,
  repository = guestRepository,
}: {
  children: ReactNode;
  repository?: DataRepository;
}) {
  const [initial] = useState(() => {
    try {
      return { data: repository.load(), error: "" };
    } catch (e) {
      return { data: createEmptyData(), error: (e as Error).message };
    }
  });
  const [data, setData] = useState(initial.data),
    [error, setError] = useState(initial.error),
    [toast, setToast] = useState(""),
    [editor, setEditor] = useState<Editor | null>(null);
  const ref = useRef(data);
  const notify = useCallback((t: string) => setToast(t), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const mode = data.settings.theme;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        mode === "system" ? (media.matches ? "dark" : "light") : mode;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data.settings.theme]);
  const commit = useCallback(
    (mutate: (d: AppData) => void, fullValidation = false) => {
      try {
        const next = structuredClone(ref.current);
        mutate(next);
        if (fullValidation) validateData(next);
        repository.save(next);
        ref.current = next;
        setData(next);
        setError("");
        return true;
      } catch (e) {
        notify((e as Error).message);
        return false;
      }
    },
    [notify, repository],
  );
  const saveRecord = useCallback(
    (c: Collection, record: Entity) => {
      record = { ...record, demo: false } as Entity;
      try {
        validateEntity(c, record);
      } catch (e) {
        notify((e as Error).message);
        return false;
      }
      const ok = commit((d) => {
        const list = d[c] as Entity[];
        const idx = list.findIndex((r) => r.id === record.id);
        if (idx >= 0) list[idx] = record;
        else list.push(record);
        if (c === "topics") {
          const t = record as AppData["topics"][number];
          const old = ref.current.topics.find((x) => x.id === t.id);
          if (!old || old.status !== t.status)
            t.statusHistory = [
              ...(old?.statusHistory || []),
              { date: dateKey(), status: t.status },
            ];
        }
        if (c === "sessions") {
          const s = record as StudySession;
          d.mcqs = d.mcqs.filter((m) => m.studySessionId !== s.id);
          if (
            s.questionsAttempted > 0 &&
            s.correct + s.incorrect === s.questionsAttempted
          )
            d.mcqs.push({
              id: s.id + "-mcq",
              date: s.date,
              subjectId: s.subjectId,
              topicId: s.topicId,
              stage: s.stage,
              difficulty: s.difficulty,
              seen: s.questionsAttempted,
              attempted: s.questionsAttempted,
              correct: s.correct,
              incorrect: s.incorrect,
              minutes: s.actualMinutes,
              errors: {},
              revisedErrors: 0,
              notes: s.problems,
              studySessionId: s.id,
            });
          const rid = s.id + "-revision";
          d.revisions = d.revisions.filter((r) => r.id !== rid);
          if (s.nextRevisionDate && s.topicId)
            d.revisions.push({
              id: rid,
              subjectId: s.subjectId,
              topicId: s.subtopicId || s.topicId,
              dueDate: s.nextRevisionDate,
              completedDate: "",
              stage: "Revision 1",
              notes: s.notes,
            });
          d.tests = d.tests.filter((t) => t.studySessionId !== s.id);
          if (s.activity === "Mock Test")
            d.tests.push({
              id: s.id + "-test",
              date: s.date,
              name: `${d.subjects.find((x) => x.id === s.subjectId)?.name || "Study"} mock test`,
              seriesId: "",
              subjectId: s.subjectId,
              topicId: s.topicId,
              stage: s.stage,
              score: s.mockScore,
              maximum: s.maximumMarks,
              rank: 0,
              attempted: s.questionsAttempted,
              correct: s.correct,
              strongTopics: "",
              weakTopics: s.problems,
              errors: {},
              notes: s.notes,
              studySessionId: s.id,
            });
        }
      }, true);
      if (ok) {
        notify("Saved to your preparation workspace.");
        setEditor(null);
      }
      return ok;
    },
    [commit, notify],
  );
  const savePYQDraft = useCallback(
    (draft: PYQDraft | undefined) => {
      try {
        if (draft) validatePYQDraft(draft);
      } catch (e) {
        notify((e as Error).message);
        return false;
      }
      return commit((d) => {
        if (draft) d.pyqDraft = structuredClone(draft);
        else delete d.pyqDraft;
      });
    },
    [commit, notify],
  );
  const submitPYQ = useCallback(
    (record: PYQRecord, nextDraft: PYQDraft) => {
      try {
        validateEntity("pyqs", record);
        validatePYQDraft(nextDraft);
      } catch (e) {
        notify((e as Error).message);
        return false;
      }
      return commit((d) => {
        if (d.pyqs.some((p) => p.id === record.id))
          throw new Error(
            "This attempt is already saved. Resume the next question.",
          );
        d.pyqs.push({ ...record, demo: false });
        d.pyqDraft = structuredClone(nextDraft);
      }, true);
    },
    [commit, notify],
  );
  const deleteRecord = useCallback(
    (c: Collection, id: string) => {
      const ok = commit((d) => {
        (d[c] as Entity[]) = (d[c] as Entity[]).filter((r) => r.id !== id);
        if (c === "sessions") {
          d.mcqs = d.mcqs.filter((m) => m.studySessionId !== id);
          d.tests = d.tests.filter((t) => t.studySessionId !== id);
          d.revisions = d.revisions.filter((r) => r.id !== id + "-revision");
        }
      }, true);
      if (ok) notify("Record deleted.");
    },
    [commit, notify],
  );
  const updateSettings = useCallback(
    (s: Settings) =>
      commit((d) => {
        d.settings = s;
        d.subjects
          .filter(
            (x) =>
              x.stage === "Optional" &&
              (x.name === ref.current.settings.optional ||
                x.name === "Optional"),
          )
          .forEach((x) => (x.name = s.optional));
      }, true),
    [commit],
  );
  const replaceData = useCallback(
    (d: AppData) => {
      try {
        validateData(d);
        repository.save(d);
        ref.current = d;
        setData(d);
        setError("");
        notify("Your workspace is ready.");
      } catch (e) {
        notify((e as Error).message);
      }
    },
    [notify],
  );
  const clearDemo = () => {
    const ok = commit((d) => {
      for (const c of [
        "sessions",
        "mcqs",
        "tests",
        "answers",
        "essays",
        "ethics",
        "currentAffairs",
        "pyqs",
        "revisions",
        "resources",
        "catalog",
        "goals",
      ] as Collection[])
        (d[c] as Entity[]) = (d[c] as (Entity & { demo?: boolean })[]).filter(
          (r) => {
            const needed =
              (c === "resources" &&
                d.sessions.some((s) => s.resourceId === r.id)) ||
              (c === "catalog" && d.tests.some((t) => t.seriesId === r.id));
            if (needed) {
              r.demo = false;
              return true;
            }
            return !r.demo;
          },
        );
      if (d.demoDates) {
        if (d.settings.prelimsDate === d.demoDates.prelims)
          d.settings.prelimsDate = "";
        if (d.settings.mainsDate === d.demoDates.mains)
          d.settings.mainsDate = "";
        delete d.demoDates;
      }
      d.topics.forEach((t) => {
        t.statusHistory = t.statusHistory.filter((h) => !h.demo);
        if (t.demo) {
          t.status = "Not Started";
          t.revisionStage = "New topic";
          t.statusHistory = [{ date: dateKey(), status: "Not Started" }];
          t.notes = "";
          t.demo = false;
        } else if (!t.statusHistory.length) {
          t.statusHistory = [{ date: dateKey(), status: t.status }];
        }
      });
    }, true);
    if (ok) notify("Fictional demo records cleared.");
  };
  const markRevision = (id: string) => {
    if (
      commit((d) => {
        const r = d.revisions.find((r) => r.id === id);
        if (!r) return;
        r.completedDate = dateKey();
        const t = d.topics.find((t) => t.id === r.topicId);
        if (t) {
          t.demo = false;
          t.revisionStage = r.stage;
          t.status = "Completed";
          t.statusHistory.push({ date: dateKey(), status: "Completed" });
        }
      }, true)
    )
      notify("Revision completed.");
  };
  const setTopicStatus = (
    id: string,
    status: import("../types").TopicStatus,
  ) => {
    commit((d) => {
      const t = d.topics.find((t) => t.id === id);
      if (t) {
        t.demo = false;
        t.status = status;
        t.statusHistory.push({ date: dateKey(), status });
        if (status === "Mastered") t.revisionStage = "Mastered";
      }
    }, true);
  };
  return (
    <Context.Provider
      value={{
        data,
        error,
        toast,
        editor,
        setEditor,
        notify,
        saveRecord,
        deleteRecord,
        updateSettings,
        replaceData,
        loadDemo: () => replaceData(createDemoData()),
        clearDemo,
        reset: () => replaceData(createEmptyData()),
        markRevision,
        setTopicStatus,
        savePYQDraft,
        submitPYQ,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const c = useContext(Context);
  if (!c) throw new Error("DataProvider is missing.");
  return c;
}
