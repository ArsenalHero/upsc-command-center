import { useRef, useState } from "react";
import {
  Download,
  Upload,
  Database,
  FlaskConical,
  Trash2,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import { useData } from "../hooks/useData";
import {
  exportJSON,
  exportCSV,
  parseBackup,
  download,
} from "../services/export";
import { collections } from "../services/validation";
import { STORAGE_KEY } from "../services/repository";
import type { AppData, Collection } from "../types";
import { ConfirmDialog } from "./ui";
export function ExportImportPanel() {
  const { data, notify, replaceData, loadDemo, clearDemo, reset, error } =
      useData(),
    input = useRef<HTMLInputElement>(null),
    [pending, setPending] = useState<AppData | null>(null),
    [confirm, setConfirm] = useState<string | null>(null),
    [collection, setCollection] = useState<Collection>("sessions");
  const demo =
    data.sessions.some((s) => s.demo) || data.mcqs.some((m) => m.demo);
  return (
    <section className="card backup-panel">
      <div className="card-heading">
        <h2>
          <Database size={18} />
          Backup & data
        </h2>
        <span className="small muted">JSON backup version 1</span>
      </div>
      <div className="backup-grid">
        <div>
          <div className="icon-tile blue">
            <FileJson size={22} />
          </div>
          <h3>Complete backup</h3>
          <p>
            Export everything, including your syllabus, settings, resources, and
            records.
          </p>
          <button className="btn primary" onClick={() => exportJSON(data)}>
            <Download size={16} />
            Export Data · JSON
          </button>
        </div>
        <div>
          <div className="icon-tile purple">
            <Upload size={22} />
          </div>
          <h3>Restore a backup</h3>
          <p>
            Import a validated JSON backup. Review its record counts before
            replacing your workspace.
          </p>
          <input
            ref={input}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file)
                try {
                  setPending(await parseBackup(file));
                } catch (err) {
                  notify(`Import failed: ${(err as Error).message}`);
                }
              e.target.value = "";
            }}
          />
          <button
            className="btn secondary"
            onClick={() => input.current?.click()}
          >
            <Upload size={16} />
            Import Data
          </button>
        </div>
        <div>
          <div className="icon-tile green">
            <FileSpreadsheet size={22} />
          </div>
          <h3>Tabular export</h3>
          <p>
            Download any collection as CSV, with human-readable subject and
            topic names.
          </p>
          <div className="button-group">
            <select
              aria-label="CSV export collection"
              value={collection}
              onChange={(e) => setCollection(e.target.value as Collection)}
            >
              {collections.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              className="btn secondary"
              onClick={() => exportCSV(data, collection)}
            >
              <Download size={16} />
              CSV
            </button>
          </div>
        </div>
      </div>
      <div className="data-actions">
        <div>
          <strong>Sample data mode</strong>
          <p>
            Explore with realistic, fictional study records. Loading demo data
            replaces the current workspace.
          </p>
        </div>
        <div className="button-group">
          <button className="btn secondary" onClick={() => setConfirm("demo")}>
            <FlaskConical size={16} />
            Load Demo Data
          </button>
          {demo && (
            <button
              className="btn secondary"
              onClick={() => setConfirm("clear-demo")}
            >
              Clear Demo Data
            </button>
          )}
        </div>
      </div>
      <div className="data-actions">
        <div>
          <strong>Reset workspace</strong>
          <p>
            Remove all records, custom topics, goals, and settings, then restore
            the default syllabus.
          </p>
        </div>
        <button
          className="btn danger-outline"
          onClick={() => setConfirm("reset")}
        >
          <Trash2 size={16} />
          Reset all data
        </button>
      </div>
      {error && (
        <button
          className="btn secondary"
          onClick={() =>
            download(
              localStorage.getItem(STORAGE_KEY) || "",
              "upsc-raw-recovery.json",
              "application/json",
            )
          }
        >
          Export preserved raw data
        </button>
      )}
      {pending && (
        <ConfirmDialog
          title="Restore this backup?"
          text={`Validated backup: ${pending.sessions.length} study sessions, ${pending.mcqs.length} MCQ records, ${pending.tests.length} tests, ${pending.topics.length} topics, ${pending.revisions.length} revisions, ${pending.lectures?.plans.length || 0} lecture targets and ${pending.lectures?.logs.length || 0} daily lecture entries. This replaces your current ${data.sessions.length} sessions and all other data. Export your current workspace first if you want to keep it.`}
          label="Restore backup"
          onClose={() => setPending(null)}
          onConfirm={() => replaceData(pending)}
        />
      )}{" "}
      {confirm && (
        <ConfirmDialog
          title={
            confirm === "demo"
              ? "Load fictional demo data?"
              : confirm === "clear-demo"
                ? "Clear demo data?"
                : "Reset your entire workspace?"
          }
          text={
            confirm === "demo"
              ? `This replaces all current data (${data.sessions.length} sessions, ${data.tests.length} tests, ${data.lectures?.logs.length || 0} daily lecture entries) with fictional demo records. Export a backup first if you need your current data.`
              : confirm === "clear-demo"
                ? "This removes fictional demo records and resets the seeded syllabus progress. Your new personal records and custom topics remain."
                : "This resets the current workspace and replaces its study records. If signed in, the reset also syncs to your account. Export a JSON backup first if you may need these records."
          }
          label={
            confirm === "demo"
              ? "Load demo"
              : confirm === "clear-demo"
                ? "Clear demo"
                : "Reset all data"
          }
          danger={confirm === "reset"}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm === "demo") loadDemo();
            else if (confirm === "clear-demo") clearDemo();
            else reset();
          }}
        />
      )}
    </section>
  );
}
