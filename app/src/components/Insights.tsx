import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Clock3,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import type { Insight } from "../types";
import { Badge } from "./ui";
export function InsightCard({
  insight,
  compact = false,
  index,
}: {
  insight: Insight;
  compact?: boolean;
  index?: number;
}) {
  const [open, setOpen] = useState(false);
  const Icon =
    insight.kind === "attention"
      ? AlertTriangle
      : insight.kind === "improving"
        ? TrendingUp
        : Clock3;
  return (
    <article className={`insight-card ${insight.kind}`}>
      <div className="insight-leading">
        {index !== undefined ? (
          <span className="priority-number">
            {String(index + 1).padStart(2, "0")}
          </span>
        ) : (
          <Icon size={18} />
        )}
      </div>
      <div className="insight-content">
        <div className="insight-title">
          <h3>{insight.title}</h3>
          {!compact && (
            <Badge tone={insight.kind === "improving" ? "green" : "amber"}>
              {insight.kind === "improving" ? "Improving" : "Attention"}
            </Badge>
          )}
        </div>
        <p>{insight.observation}</p>
        <div className="insight-action">{insight.action}</div>
        <button
          className="text-btn"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
        >
          {open ? "Hide evidence" : "View evidence"}
          <ChevronRight size={14} />
        </button>
        {open && (
          <dl className="insight-evidence">
            <dt>Evidence</dt>
            <dd>{insight.evidence}</dd>
            <dt>Why it matters</dt>
            <dd>{insight.why}</dd>
            <dt>Target</dt>
            <dd>{insight.target}</dd>
          </dl>
        )}
      </div>
    </article>
  );
}
export function PriorityPanel({
  items,
  title = "What should I focus on next?",
  limit = 5,
}: {
  items: Insight[];
  title?: string;
  limit?: number;
}) {
  return (
    <section className="card priority-panel">
      <div className="card-heading">
        <div>
          <div className="eyebrow">
            <Sparkles size={14} />
            PREPARATION INSIGHTS
          </div>
          <h2>{title}</h2>
        </div>
        <Link className="text-btn" to="/weak-areas">
          Explore weak areas
          <ChevronRight size={16} />
        </Link>
      </div>
      {items.length ? (
        <div className="priorities">
          {items
            .filter((i) => i.kind !== "improving")
            .slice(0, limit)
            .map((insight, i) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                compact
                index={i}
              />
            ))}
        </div>
      ) : (
        <div className="small muted padded">
          Add study and practice records to receive evidence-backed priorities.
        </div>
      )}
    </section>
  );
}
