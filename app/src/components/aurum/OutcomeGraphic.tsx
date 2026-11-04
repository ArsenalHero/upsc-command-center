import { aurumAccuracy, type AurumSummary } from "../../utils/aurum";

const segments = (s: AurumSummary) => [
  { key: "correct", label: "Correct", count: s.correct },
  { key: "incorrect", label: "Wrong", count: s.incorrect },
  { key: "skipped", label: "Skipped", count: s.skipped },
  { key: "pending", label: "Not reviewed", count: Math.max(0, s.total - s.answered) },
];
export function OutcomeBar({ summary }: { summary: AurumSummary }) {
  return <div className="aurum-outcome-bar" role="img" aria-label={segments(summary).map(v => `${v.count} ${v.label.toLowerCase()}`).join(", ")}>
    {segments(summary).map(v => <span key={v.key} className={v.key} style={{ width: `${summary.total ? 100 * v.count / summary.total : 0}%` }} />)}
  </div>;
}
export function OutcomeGraphic({ summary, title = "Right vs wrong" }: { summary: AurumSummary; title?: string }) {
  const accuracy = aurumAccuracy(summary), circle = 2 * Math.PI * 46;
  let offset = 0;
  return <section className="card aurum-outcome-card" aria-label={title}>
    <div className="aurum-report-heading"><h3>{title}</h3><span>{summary.answered} of {summary.total} reviewed</span></div>
    <div className="aurum-outcome-graphic">
      <div className="aurum-outcome-ring"><svg viewBox="0 0 120 120" role="img" aria-label={segments(summary).map(v => `${v.count} ${v.label.toLowerCase()}`).join(", ")}>
        <circle className="aurum-ring-base" cx="60" cy="60" r="46" fill="none" strokeWidth="12" />
        {segments(summary).map(v => {
          const length = summary.total ? circle * v.count / summary.total : 0, start = offset; offset += length;
          return <circle key={v.key} className={v.key} cx="60" cy="60" r="46" fill="none" strokeWidth="12" strokeDasharray={`${length} ${circle - length}`} strokeDashoffset={-start} transform="rotate(-90 60 60)" />;
        })}
      </svg><div><strong>{accuracy === null ? "—" : `${Math.round(accuracy)}%`}</strong><small>accuracy</small></div></div>
      <div className="aurum-outcome-legend">{segments(summary).map(v => <div key={v.key}><span className={v.key} /><span>{v.label}</span><strong>{v.count}</strong></div>)}</div>
    </div>
    <p className="aurum-report-note">Accuracy uses correct and wrong answers. Skipped and unreviewed questions are excluded.</p>
  </section>;
}
