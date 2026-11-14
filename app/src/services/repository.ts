import type { AppData } from "../types";
import { createEmptyData } from "../data/defaults";
import { validateData } from "./validation";
export const STORAGE_KEY = "upsc-command-center:v1";
// Device and authenticated cloud adapters share the same editor interface.
export interface DataRepository {
  load(): AppData;
  save(data: AppData): void;
}
export class LocalStorageRepository implements DataRepository {
  load(): AppData {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyData();
    try {
      return validateData(JSON.parse(raw));
    } catch {
      throw new Error(
        "Saved data could not be opened. It has been preserved. Import a valid backup or export the raw saved data from Settings before replacing it.",
      );
    }
  }
  save(data: AppData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      throw new Error(
        "The browser could not save this change. Storage may be full or unavailable. Export a backup before clearing browser storage.",
      );
    }
  }
}
