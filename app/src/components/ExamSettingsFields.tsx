import type { Settings } from "../types";
import { changeCseYear, resolvedCseDates, selectedExam } from "../utils/examSettings";

export function ExamSettingsFields({ settings, onChange, section = "all" }: {
  settings: Settings; onChange: (settings: Settings) => void; section?: "all" | "selection" | "dates";
}) {
  const statePsc = selectedExam(settings) === "State PSC", dates = resolvedCseDates(settings);
  const change = (key: keyof Settings, value: string) => onChange({ ...settings, [key]: value });
  return <>
    <div className="form-grid exam-settings-fields">
      {section !== "dates" && <>
        <label>Preparing for<select aria-label="Exam selection" value={selectedExam(settings)} onChange={e => change("examType", e.target.value)}>
          <option>UPSC CSE</option><option>State PSC</option>
        </select></label>
        {statePsc
          ? <label>State PSC exam name<input required aria-label="State PSC exam name" maxLength={120} placeholder="e.g. UPPSC PCS, BPSC or MPSC" value={settings.statePscName || ""} onChange={e => change("statePscName", e.target.value)} /></label>
          : <label>Target year<input type="number" required min={2000} max={2200} step={1} value={settings.year} onChange={e => onChange(changeCseYear(settings, Number(e.target.value)))} /></label>}
      </>}
      {section !== "selection" && (statePsc
        ? <label>State PSC exam date<input type="date" required aria-label="State PSC exam date" value={settings.statePscDate || ""} onChange={e => change("statePscDate", e.target.value)} /></label>
        : <>
          <label>Prelims date<input type="date" value={dates.prelims} onChange={e => change("prelimsDate", e.target.value)} /></label>
          <label>Mains date<input type="date" value={dates.mains} onChange={e => change("mainsDate", e.target.value)} /></label>
        </>)}
    </div>
    {section !== "selection" && <p className="form-note">{statePsc
      ? "Your exam name and date appear on the dashboard. Enter the date for the exam or stage you are targeting."
      : settings.year === 2027 ? "CSE 2027: Prelims on 23 May and Mains on 20 August. You can update these dates here." : "Enter your planned dates from the exam calendar."} Countdowns use the start of the exam date in Indian Standard Time (IST).</p>}
  </>;
}
