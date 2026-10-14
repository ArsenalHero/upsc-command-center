import { useEffect, useState } from "react";
import { dateKey } from "../utils/date";

export function useToday() {
  const [today, setToday] = useState(dateKey);
  useEffect(() => {
    const refresh = () => setToday(dateKey());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return today;
}
