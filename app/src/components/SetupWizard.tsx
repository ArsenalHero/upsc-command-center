import { useState } from "react";
import {
  Target,
  BookOpen,
  Clock3,
  CalendarDays,
  CheckCircle2,
  PieChart,
  ChevronLeft,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { Modal, ProgressBar } from "./ui";
import { ExamSettingsFields } from "./ExamSettingsFields";
const steps = [
  "Your target exam",
  "Your Optional",
  "Your study rhythm",
  "Your exam dates",
  "Your weekly goals",
  "Your study balance",
];
export function SetupWizard() {
  const { data, updateSettings, loadDemo } = useData(),
    [step, setStep] = useState(0),
    [settings, setSettings] = useState(data.settings);
  if (data.settings.setupCompleted) return null;
  const icons = [
      Target,
      BookOpen,
      Clock3,
      CalendarDays,
      CheckCircle2,
      PieChart,
    ],
    Icon = icons[step],
    total = Object.values(settings.allocation).reduce((a, b) => a + b, 0);
  const skip = () => updateSettings({ ...data.settings, setupCompleted: true });
  const finish = () => updateSettings({ ...settings, setupCompleted: true });
  return (
    <Modal title="Set up your preparation workspace" onClose={skip}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 5) setStep(step + 1);
          else finish();
        }}
      >
        <div className="modal-body wizard-body">
          <div className="wizard-progress">
            <span>STEP {step + 1} OF 6</span>
            <ProgressBar value={((step + 1) / 6) * 100} />
          </div>
          <div className="wizard-icon">
            <Icon size={28} />
          </div>
          <h2>{steps[step]}</h2>
          {step === 0 && (
            <>
              <p>Choose UPSC CSE or the State PSC exam you are preparing for.</p>
              <ExamSettingsFields settings={settings} onChange={setSettings} section="selection" />
              <button
                type="button"
                className="btn secondary"
                onClick={loadDemo}
              >
                Explore with fictional demo data
              </button>
            </>
          )}
          {step === 1 && (
            <>
              <p>
                Choose a subject or enter your own. You can customize every unit
                and topic later.
              </p>
              <label>
                Optional subject
                <input
                  list="wizard-optionals"
                  value={settings.optional}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, optional: e.target.value }))
                  }
                />
                <datalist id="wizard-optionals">
                  {[
                    "Sociology",
                    "Anthropology",
                    "Geography",
                    "History",
                    "Political Science & International Relations",
                    "Public Administration",
                    "Mathematics",
                    "Philosophy",
                    "Literature",
                  ].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </datalist>
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <p>Start with a daily target you can review consistently.</p>
              <label>
                Daily study hours
                <input
                  type="number"
                  min={0.1}
                  max={24}
                  step="any"
                  required
                  value={settings.dailyHours}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      dailyHours: Number(e.target.value),
                    }))
                  }
                />
              </label>
            </>
          )}
          {step === 3 && (
            <>
              <ExamSettingsFields settings={settings} onChange={setSettings} section="dates" />
            </>
          )}
          {step === 4 && (
            <>
              <p>
                Reserve time for the whole preparation, including Optional and
                CSAT.
              </p>
              <div className="form-grid">
                {(
                  [
                    ["weeklyHours", "Weekly study hours"],
                    ["optionalHours", "Optional hours / week"],
                    ["csatHours", "CSAT hours / week"],
                    ["mcqTarget", "MCQs / day"],
                    ["answerTarget", "Answers / day"],
                    ["testTarget", "Tests / month"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min={0}
                      max={key === "weeklyHours" ? 168 : undefined}
                      required
                      step="any"
                      value={settings[key]}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          [key]: Number(e.target.value),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <p>
                Set your desired share of study time. The total must equal 100%.
              </p>
              <div className="allocation-fields">
                {Object.entries(settings.allocation).map(([name, n]) => (
                  <label key={name}>
                    <span>{name}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={n}
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
              <strong
                className={
                  Math.abs(total - 100) < 0.1 ? "positive" : "red-text"
                }
              >
                Total: {total}%
              </strong>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button type="button" className="text-btn" onClick={skip}>
            Skip setup
          </button>
          {step > 0 && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}
          <button
            type="submit"
            className="btn primary"
            disabled={step === 5 && Math.abs(total - 100) >= 0.1}
          >
            {step === 5 ? "Open dashboard" : "Continue"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
