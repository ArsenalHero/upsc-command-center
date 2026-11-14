import type { Filters } from "../types";
import { useData } from "../hooks/useData";
import { addDays, dateKey, monthsAgo } from "../utils/date";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
export function DateRangeSelector({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  return (
    <div className="range-select">
      <CalendarDays size={16} />
      <select
        aria-label="Date range"
        value={
          filters.to === dateKey()
            ? String(
                Math.round(
                  (new Date(filters.to).getTime() -
                    new Date(filters.from).getTime()) /
                    86400000,
                ) + 1,
              )
            : "custom"
        }
        onChange={(e) => {
          const n = Number(e.target.value);
          if (n)
            onChange({
              ...filters,
              from: addDays(dateKey(), -(n - 1)),
              to: dateKey(),
            });
        }}
      >
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="90">Last 3 months</option>
        <option value="365">Last year</option>
        <option value="custom">Custom dates</option>
      </select>
    </div>
  );
}
export function SubjectFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const { data } = useData();
  return (
    <select
      aria-label="Filter by subject"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">All subjects</option>
      {data.subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
export function FilterBar({
  filters,
  onChange,
  full = true,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  full?: boolean;
}) {
  const { data } = useData();
  const papers = [
      ...new Set([
        ...data.subjects.map((s) => s.paper),
        ...data.sessions.map((s) => s.paper),
        ...data.answers.map((s) => s.paper),
        ...data.pyqs.map((s) => s.paper),
      ]),
    ],
    activities = [
      ...new Set([
        ...data.sessions.map((s) => s.activity),
        ...data.catalog.filter((x) => x.type === "Activity").map((x) => x.name),
      ]),
    ];
  return (
    <div className="filter-bar">
      <DateRangeSelector filters={filters} onChange={onChange} />
      <SubjectFilter
        value={filters.subjectId}
        onChange={(subjectId) =>
          onChange({ ...filters, subjectId, topicId: "" })
        }
      />
      <select
        aria-label="Filter by stage"
        value={filters.stage}
        onChange={(e) => onChange({ ...filters, stage: e.target.value })}
      >
        <option value="">All stages</option>
        {["Prelims", "Mains", "Both", "Optional", "CSAT"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <details className="filter-extra">
        <summary>
          <SlidersHorizontal size={16} />
          More filters
        </summary>
        <div className="filter-fields">
          <label>
            From
            <input
              aria-label="From date"
              type="date"
              value={filters.from}
              max={filters.to}
              onChange={(e) => {
                if (e.target.value && e.target.value <= filters.to)
                  onChange({ ...filters, from: e.target.value });
              }}
            />
          </label>
          <label>
            To
            <input
              aria-label="To date"
              type="date"
              value={filters.to}
              min={filters.from}
              onChange={(e) => {
                if (e.target.value && e.target.value >= filters.from)
                  onChange({ ...filters, to: e.target.value });
              }}
            />
          </label>
          {full && (
            <>
              <label>
                Paper
                <select
                  value={filters.paper}
                  onChange={(e) =>
                    onChange({ ...filters, paper: e.target.value })
                  }
                >
                  <option value="">All papers</option>
                  {papers.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                Topic
                <select
                  value={filters.topicId}
                  onChange={(e) =>
                    onChange({ ...filters, topicId: e.target.value })
                  }
                >
                  <option value="">All topics</option>
                  {data.topics
                    .filter(
                      (t) =>
                        !filters.subjectId || t.subjectId === filters.subjectId,
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Study type
                <select
                  value={filters.activity}
                  onChange={(e) =>
                    onChange({ ...filters, activity: e.target.value })
                  }
                >
                  <option value="">All activities</option>
                  {activities.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label>
                Test series
                <select
                  value={filters.testType}
                  onChange={(e) =>
                    onChange({ ...filters, testType: e.target.value })
                  }
                >
                  <option value="">All series</option>
                  {data.catalog
                    .filter((x) => x.type === "Test series")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
        </div>
      </details>
    </div>
  );
}
