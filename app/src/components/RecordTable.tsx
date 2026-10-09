import { useMemo, useState } from "react";
import {
  Edit3,
  Trash2,
  Download,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Collection, Entity } from "../types";
import { useData } from "../hooks/useData";
import { exportCSV } from "../services/export";
import { prettyDate } from "../utils/date";
import { EmptyState, ConfirmDialog, Badge } from "./ui";
import { formTitles } from "./RecordForm";
export function RecordTable({
  collection,
  records,
  columns,
  title,
  className = "",
}: {
  collection: Collection;
  records?: Entity[];
  columns?: {
    key: string;
    label: string;
    render?: (r: any) => React.ReactNode;
  }[];
  title?: string;
  className?: string;
}) {
  const { data, setEditor, deleteRecord } = useData(),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [remove, setRemove] = useState<string | null>(null);
  const list = records || data[collection];
  const filtered = useMemo(
    () =>
      list
        .filter((r) =>
          JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
        )
        .slice()
        .sort((a: any, b: any) =>
          String(b.date || b.dueDate || "").localeCompare(
            String(a.date || a.dueDate || ""),
          ),
        ),
    [list, query],
  );
  const count = Math.max(1, Math.ceil(filtered.length / 10));
  const current = Math.min(page, count - 1);
  const visible = filtered.slice(current * 10, current * 10 + 10);
  const cols = columns || [
    {
      key: "date",
      label: "Date",
      render: (r: any) => prettyDate(r.date || r.dueDate || ""),
    },
    {
      key: "label",
      label: "Record",
      render: (r: any) =>
        r.name ||
        r.title ||
        r.question ||
        r.caseStudy ||
        r.topic ||
        data.topics.find((t) => t.id === r.topicId)?.name ||
        r.activity ||
        r.notes ||
        "Record",
    },
    {
      key: "subjectId",
      label: "Subject",
      render: (r: any) =>
        data.subjects.find((s) => s.id === r.subjectId)?.name ||
        r.paper ||
        r.category ||
        "—",
    },
  ];
  return (
    <section className={`card records-card ${className}`}>
      <div className="card-heading">
        <h2>{title || `${formTitles[collection] || collection} records`}</h2>
        <button
          className="btn secondary small-btn"
          disabled={!list.length}
          onClick={() => exportCSV(data, collection)}
        >
          <Download size={14} />
          CSV
        </button>
      </div>
      <div className="record-search">
        <Search size={16} />
        <input
          aria-label="Search records"
          placeholder="Search these records…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
        <span className="small muted">{filtered.length} records</span>
      </div>
      {visible.length ? (
        <>
          <table className="record-table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r: any) => (
                <tr key={r.id}>
                  {cols.map((c) => (
                    <td key={c.key} data-label={c.label}>
                      {c.render ? c.render(r) : String(r[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="row-actions">
                    <button
                      className="icon-btn"
                      aria-label={`Edit ${formTitles[collection]}`}
                      onClick={() => setEditor({ collection, record: r })}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`Delete ${formTitles[collection]}`}
                      onClick={() => setRemove(r.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span>
              {current * 10 + 1}–{Math.min((current + 1) * 10, filtered.length)}{" "}
              of {filtered.length}
            </span>
            <div>
              <button
                className="icon-btn"
                aria-label="Previous page"
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft size={17} />
              </button>
              <span>
                {current + 1} / {count}
              </span>
              <button
                className="icon-btn"
                aria-label="Next page"
                disabled={current + 1 >= count}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title={
            query
              ? "No matching records."
              : `No ${formTitles[collection]?.toLowerCase() || collection} records yet.`
          }
          text={
            query
              ? "Try another search term."
              : "Start with your first entry to build this analysis."
          }
          onAction={query ? undefined : () => setEditor({ collection })}
          action={`Add ${formTitles[collection] || "record"}`}
        />
      )}
      {remove && (
        <ConfirmDialog
          title="Delete this record?"
          text="This removes the record from your local workspace. An exported backup can restore it. Subjects and topics with linked records must be kept until those records are removed."
          onClose={() => setRemove(null)}
          onConfirm={() => deleteRecord(collection, remove)}
          label="Delete record"
          danger
        />
      )}
    </section>
  );
}
