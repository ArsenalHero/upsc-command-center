import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import type { GoldenAPI } from "./GoldenCatalogue";

type Totals = { questions: number; tests: number };

export function MockQuestionTotal({ api }: { api: GoldenAPI }) {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    const refresh = () => {
      api<Totals>("catalog-summary").then(value => {
        if (![value?.questions, value?.tests].every(n => Number.isSafeInteger(n) && n >= 0)) {
          throw new Error("Count unavailable");
        }
        if (live) { setTotals(value); setError(false); }
      }).catch(() => { if (live) setError(true); });
    };
    setTotals(null); setError(false); refresh();
    window.addEventListener("focus", refresh);
    return () => { live = false; window.removeEventListener("focus", refresh); };
  }, [api, retry]);

  return <aside className="mock-question-total" aria-label="Mock question totals" aria-live="polite" aria-atomic="true">
    <span className="mock-question-total-icon"><BookOpen size={22} aria-hidden="true" /></span>
    <div>
      <span className="mock-question-total-label">Total questions</span>
      <strong>{totals ? totals.questions.toLocaleString("en-IN") : error ? "—" : "…"}</strong>
      <small>{totals ? `Across ${totals.tests.toLocaleString("en-IN")} mock ${totals.tests === 1 ? "test" : "tests"}` : error ? "Count unavailable" : "Counting available mocks…"}</small>
      {error && <button type="button" className="text-btn" onClick={() => setRetry(n => n + 1)}>Retry count</button>}
    </div>
  </aside>;
}
