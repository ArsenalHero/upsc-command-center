import { useState } from "react";
import { useData } from "../hooks/useData";
import { Modal } from "./ui";
import { ExamSettingsFields } from "./ExamSettingsFields";

export function WorkspaceExamDialog({ onClose }: { onClose: () => void }) {
  const { data, updateSettings, notify } = useData();
  const [settings, setSettings] = useState(data.settings);
  return <Modal title="Choose your workspace exam" onClose={onClose}>
    <form onSubmit={e => {
      e.preventDefault();
      if (updateSettings({ ...data.settings, examType: settings.examType || "UPSC CSE", year: settings.year,
        prelimsDate: settings.prelimsDate, mainsDate: settings.mainsDate,
        statePscName: settings.statePscName?.trim() || "", statePscDate: settings.statePscDate || "" })) {
        notify("Workspace exam saved. Dashboard countdown updated."); onClose();
      }
    }}>
      <div className="modal-body"><ExamSettingsFields settings={settings} onChange={setSettings} /></div>
      <div className="modal-foot"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">Save exam</button></div>
    </form>
  </Modal>;
}
