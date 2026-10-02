import { useEffect, useState } from "react";
import {
  Save,
  Plus,
  Sun,
  Moon,
  Monitor,
  SlidersHorizontal,
} from "lucide-react";
import { useData } from "../hooks/useData";
import type { Settings as SettingsType, WeightKey } from "../types";
import { PageHeader, Badge } from "../components/ui";
import { ExportImportPanel } from "../components/ExportImportPanel";
const targets: [keyof SettingsType, string, string][] = [
  ["dailyHours", "Daily study hours", "hours"],
  ["weeklyHours", "Weekly study hours", "hours"],
  ["monthlyHours", "Monthly study hours", "hours"],
  ["mcqTarget", "Daily MCQ target", "questions"],
  ["answerTarget", "Daily answer target", "answers"],
  ["essayTarget", "Monthly essay target", "essays"],
  ["revisionTarget", "Monthly revision target", "revisions"],
  ["testTarget", "Monthly test target", "tests"],
  ["pyqTarget", "Monthly PYQ target", "questions"],
  ["optionalHours", "Weekly Optional hours", "hours"],
  ["csatHours", "Weekly CSAT hours", "hours"],
];
export default function Settings() {
  const { data, updateSettings, setEditor, notify } = useData(),
    [settings, setSettings] = useState(data.settings),
    [newCategory, setNewCategory] = useState("");
  useEffect(() => setSettings(data.settings), [data.settings]);
  const change = (key: keyof SettingsType, value: any) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const total = Object.values(settings.allocation).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader
        eyebrow="MAKE IT YOURS"
        title="Preparation settings"
        description="Configure targets, priorities, allocation, thresholds, and transparent productivity scoring."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (updateSettings(settings)) notify("Preparation settings saved.");
        }}
      >
        <div className="settings-grid">
          <section className="card settings-section">
            <h2>Exam & preparation</h2>
            <div className="form-grid">
              <label>
                Target UPSC year
                <input
                  type="number"
                  min={2000}
                  max={2200}
                  value={settings.year}
                  onChange={(e) => change("year", Number(e.target.value))}
                />
              </label>
              <label>
                Optional subject
                <input
                  value={settings.optional}
                  onChange={(e) => change("optional", e.target.value)}
                />
              </label>
              <label>
                Prelims date
                <input
                  type="date"
                  value={settings.prelimsDate}
                  onChange={(e) => change("prelimsDate", e.target.value)}
                />
              </label>
              <label>
                Mains date
                <input
                  type="date"
                  value={settings.mainsDate}
                  onChange={(e) => change("mainsDate", e.target.value)}
                />
              </label>
            </div>
            <p className="form-note">
              Set your planned dates from the official exam calendar. Dates are
              left blank until you enter them.
            </p>
          </section>
          <section className="card settings-section">
            <h2>Study & practice targets</h2>
            <div className="form-grid">
              {targets.map(([key, label, unit]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={key === "dailyHours" ? 0.1 : 0}
                    max={
                      key === "dailyHours"
                        ? 24
                        : key === "weeklyHours"
                          ? 168
                          : undefined
                    }
                    step="any"
                    value={Number(settings[key])}
                    onChange={(e) => change(key, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>
          </section>
          <section className="card settings-section">
            <div className="card-heading">
              <h2>Study allocation</h2>
              <Badge tone={Math.abs(total - 100) < 0.1 ? "green" : "amber"}>
                {total.toFixed(1)}% / 100%
              </Badge>
            </div>
            <div className="allocation-fields">
              {Object.entries(settings.allocation).map(([name, value]) => (
                <label key={name}>
                  <span>{name}</span>
                  <input
                    type="number"
                    aria-label={`${name} allocation percentage`}
                    min={0}
                    max={100}
                    step="any"
                    value={value}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        allocation: {
                          ...s.allocation,
                          [name]: Number(e.target.value),
                        },
                      }))
                    }
                  />
                  <span>%</span>
                </label>
              ))}
            </div>
            <div className="button-group">
              <input
                aria-label="New allocation category"
                placeholder="Custom activity or subject name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button
                type="button"
                className="btn secondary small-btn"
                onClick={() => {
                  if (newCategory.trim()) {
                    setSettings((s) => ({
                      ...s,
                      allocation: { ...s.allocation, [newCategory.trim()]: 0 },
                    }));
                    setNewCategory("");
                  }
                }}
              >
                <Plus size={15} />
                Add
              </button>
            </div>
            <p className="form-note">
              Targets must total 100%. Custom category names match study
              activities or subject names exactly.
            </p>
          </section>
          <section className="card settings-section">
            <h2>Knowledge & trend thresholds</h2>
            <div className="form-grid">
              <label>
                Strength threshold %
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.strengthThreshold}
                  onChange={(e) =>
                    change("strengthThreshold", Number(e.target.value))
                  }
                />
              </label>
              <label>
                Weakness threshold %
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={settings.weaknessThreshold}
                  onChange={(e) =>
                    change("weaknessThreshold", Number(e.target.value))
                  }
                />
              </label>
              <label>
                Minimum MCQ sample
                <input
                  type="number"
                  min={1}
                  value={settings.minimumSample}
                  onChange={(e) =>
                    change("minimumSample", Number(e.target.value))
                  }
                />
              </label>
              <label>
                Meaningful trend change % / pp
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={settings.trendThreshold}
                  onChange={(e) =>
                    change("trendThreshold", Number(e.target.value))
                  }
                />
              </label>
            </div>
            <p className="form-note">
              Weakness needs at least two low measured indicators. Strength
              needs most measured indicators above your threshold. Counts use
              relative change; percentages use percentage points.
            </p>
          </section>
          <section className="card settings-section">
            <h2>Productivity weights</h2>
            <p>
              Score = Σ(component score × weight) / Σ(available weights).
              Missing indicators are excluded and weights are normalized.
            </p>
            <div className="form-grid">
              {(
                [
                  ["target", "Target completion"],
                  ["focus", "Focus"],
                  ["accuracy", "MCQ accuracy"],
                  ["revision", "Revision completion"],
                  ["questions", "Question target"],
                  ["answers", "Answer target"],
                ] as [WeightKey, string][]
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={settings.weights[key]}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        weights: {
                          ...s.weights,
                          [key]: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <p className="form-note">
              Every component is capped at 100%. Focus is average focus × 10.
              Practice and hours use your daily targets.
            </p>
          </section>
          <section className="card settings-section">
            <h2>Appearance</h2>
            <div className="theme-options">
              {(["light", "dark", "system"] as const).map((mode, i) => {
                const Icon = [Sun, Moon, Monitor][i];
                return (
                  <label
                    key={mode}
                    className={settings.theme === mode ? "selected" : ""}
                  >
                    <Icon size={20} />
                    <input
                      type="radio"
                      name="theme"
                      value={mode}
                      checked={settings.theme === mode}
                      onChange={() => change("theme", mode)}
                    />
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </label>
                );
              })}
            </div>
            <h3>Subject importance & allocation</h3>
            <div className="subject-settings">
              {data.subjects.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() =>
                    setEditor({ collection: "subjects", record: s })
                  }
                >
                  <span>{s.name}</span>
                  <strong>
                    {s.priority}/5 · {s.targetAllocation}%
                  </strong>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="text-btn"
              onClick={() => setEditor({ collection: "subjects" })}
            >
              <Plus size={15} />
              Add custom subject
            </button>
          </section>
        </div>
        <div className="settings-save">
          <button className="btn primary" type="submit">
            <Save size={16} />
            Save settings
          </button>
          <span className="small muted">Changes apply after saving.</span>
        </div>
      </form>
      <ExportImportPanel />
    </>
  );
}
