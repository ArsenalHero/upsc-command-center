import type { Settings } from "../types";

// The 2027 dates supplied for this workspace. Keep every date editable.
export const cseExamDates: Record<number, { prelims: string; mains: string }> = {
  2027: { prelims: "2027-05-23", mains: "2027-08-20" },
};

export const selectedExam = (settings: Settings) => settings.examType || "UPSC CSE";
export const workspaceExamLabel = (settings: Settings) => selectedExam(settings) === "State PSC"
  ? settings.statePscName?.trim() || "State PSC"
  : `CSE ${settings.year}`;

export const resolvedCseDates = (settings: Settings) => ({
  prelims: settings.prelimsDate || cseExamDates[settings.year]?.prelims || "",
  mains: settings.mainsDate || cseExamDates[settings.year]?.mains || "",
});

export function changeCseYear(settings: Settings, year: number): Settings {
  const previous = cseExamDates[settings.year], next = cseExamDates[year];
  return {
    ...settings, year,
    prelimsDate: !settings.prelimsDate || settings.prelimsDate === previous?.prelims
      ? next?.prelims || "" : settings.prelimsDate,
    mainsDate: !settings.mainsDate || settings.mainsDate === previous?.mains
      ? next?.mains || "" : settings.mainsDate,
  };
}

export function dashboardExams(settings: Settings) {
  if (selectedExam(settings) === "State PSC")
    return [{ id: "state-psc", name: workspaceExamLabel(settings), date: settings.statePscDate || "" }];
  const dates = resolvedCseDates(settings);
  return [
    { id: "prelims", name: `CSE ${settings.year} Prelims`, date: dates.prelims },
    { id: "mains", name: `CSE ${settings.year} Mains`, date: dates.mains },
  ];
}

export function examCountdown(date: string, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const calendar = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== date) return null;
  // A date alone specifies no paper start time: count to the start of that date in India.
  const target = new Date(`${date}T00:00:00+05:30`).getTime();
  if (!Number.isFinite(now)) return null;
  const totalSeconds = Math.max(0, Math.ceil((target - now) / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor(totalSeconds % 86400 / 3600),
    minutes: Math.floor(totalSeconds % 3600 / 60),
    seconds: totalSeconds % 60,
    totalSeconds,
    reached: now >= target,
  };
}
