import { useState } from "react";
import { Plus, BookOpen, ExternalLink } from "lucide-react";
import { useData } from "../hooks/useData";
import { PageHeader, Badge } from "../components/ui";
import { RecordTable } from "../components/RecordTable";
const safeURL = (url: string) => (/^https?:\/\//i.test(url) ? url : null);
export default function Resources() {
  const { data, setEditor } = useData(),
    [tab, setTab] = useState("Resources");
  return (
    <>
      <PageHeader
        eyebrow="A PLACE FOR EVERY SOURCE"
        title="Resources & custom categories"
        description="Add your own books, courses, coaching modules, test series, activities, and categories."
        action={
          <button
            className="btn primary"
            onClick={() =>
              setEditor({
                collection: tab === "Resources" ? "resources" : "catalog",
                preset: tab === "Resources" ? undefined : { type: tab },
              })
            }
          >
            <Plus size={16} />
            Add {tab === "Resources" ? "Resource" : tab}
          </button>
        }
      />
      <div className="tabs" role="tablist" aria-label="Resource type">
        {[
          "Resources",
          "Activity",
          "Course",
          "Coaching module",
          "Test series",
          "Category",
        ].map((t) => (
          <button
            role="tab"
            aria-selected={t === tab}
            className={t === tab ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t === "Activity" ? "Custom activities" : t}
          </button>
        ))}
      </div>
      {tab === "Resources" ? (
        <RecordTable
          collection="resources"
          className="resource-records"
          columns={[
            {
              key: "name",
              label: "Resource",
              render: (r) => (
                <>
                  <strong>{r.name}</strong>
                  <small>{r.notes}</small>
                </>
              ),
            },
            { key: "type", label: "Type" },
            {
              key: "subjectId",
              label: "Subject",
              render: (r) =>
                data.subjects.find((s) => s.id === r.subjectId)?.name ||
                "General",
            },
            {
              key: "url",
              label: "Link",
              render: (r) =>
                safeURL(r.url) ? (
                  <a
                    href={safeURL(r.url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-btn"
                  >
                    Open resource
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      ) : (
        <RecordTable
          key={tab}
          collection="catalog"
          records={data.catalog.filter((c) => c.type === tab)}
          title={tab === "Activity" ? "Custom study activities" : tab}
          columns={[
            { key: "name", label: "Name" },
            {
              key: "subjectId",
              label: "Subject",
              render: (r) =>
                data.subjects.find((s) => s.id === r.subjectId)?.name ||
                "General",
            },
            { key: "notes", label: "Notes" },
          ]}
        />
      )}
      <section className="card custom-shortcuts">
        <h2>Extend your preparation system</h2>
        <div className="button-group">
          <button
            className="btn secondary"
            onClick={() => setEditor({ collection: "subjects" })}
          >
            <Plus size={15} />
            Add Subject
          </button>
          <button
            className="btn secondary"
            onClick={() => setEditor({ collection: "topics" })}
          >
            <Plus size={15} />
            Add Topic
          </button>
          <button
            className="btn secondary"
            onClick={() =>
              setEditor({ collection: "catalog", preset: { type: "Activity" } })
            }
          >
            <Plus size={15} />
            Add Custom Activity
          </button>
          <button
            className="btn secondary"
            onClick={() =>
              setEditor({
                collection: "catalog",
                preset: { type: "Test series" },
              })
            }
          >
            <Plus size={15} />
            Add Test Series
          </button>
        </div>
        <p>
          New subjects, resources, activities, and series appear in the relevant
          entry forms, filters, and analytics.
        </p>
      </section>
    </>
  );
}
