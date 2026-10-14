import { useEffect, useState } from "react";
import type { Settings } from "../types";
import { normalizeAppearance, selectedLandscape } from "../utils/appearance";
import { dateKey } from "../utils/date";

export function useAppearance(settings: Settings) {
  const appearance = normalizeAppearance(settings.appearance);
  const [day, setDay] = useState(dateKey);
  const [deviceDark, setDeviceDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    if (settings.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const refresh = () => setDeviceDark(media.matches);
    refresh();
    media.addEventListener("change", refresh);
    return () => media.removeEventListener("change", refresh);
  }, [settings.theme]);
  useEffect(() => {
    if (appearance.wallpaper !== "daily") return;
    const refresh = () => setDay(dateKey());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [appearance.wallpaper]);
  return { appearance, wallpaper: selectedLandscape(appearance.wallpaper, day, appearance.favourites), resolvedTheme: settings.theme === "system" ? (deviceDark ? "dark" : "light") : settings.theme };
}
