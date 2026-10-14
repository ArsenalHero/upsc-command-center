import type { AppearanceSettings, Settings } from "../types";
import { dateKey } from "./date";

export const appearancePalettes = [
  { id: "blue", name: "Command blue", description: "Clear & familiar", light: ["#3158eb", "#eef2ff", "#f5f7fb"], dark: ["#8299ff", "#253255", "#101624"] },
  { id: "forest", name: "Forest", description: "Calm & grounded", light: ["#176c51", "#e8f5ef", "#f3f8f5"], dark: ["#72d9b2", "#203e33", "#111d19"] },
  { id: "violet", name: "Violet", description: "Soft & thoughtful", light: ["#7441bc", "#f1ebfb", "#f7f5fb"], dark: ["#c4a1ff", "#392b51", "#1a1525"] },
  { id: "rose", name: "Rose", description: "Warm & gentle", light: ["#a73762", "#fbedf2", "#fbf5f7"], dark: ["#f6a0bd", "#472b37", "#23171c"] },
  { id: "sand", name: "Sandstone", description: "Quiet & earthy", light: ["#875b21", "#f8f0e2", "#f9f7f2"], dark: ["#ecc58b", "#423627", "#211c15"] },
] as const;

export const landscapeWallpapers = [
  { id: "mountains", name: "Mountain dawn", description: "Snowy peaks & still water", src: "./wallpapers/mountain-dawn.webp", thumbnail: "./wallpapers/mountain-dawn-thumb.webp" },
  { id: "forest", name: "Forest lake", description: "Green trees & morning mist", src: "./wallpapers/forest-lake.webp", thumbnail: "./wallpapers/forest-lake-thumb.webp" },
  { id: "coast", name: "Coastal sunset", description: "Quiet waves & golden light", src: "./wallpapers/coastal-sunset.webp", thumbnail: "./wallpapers/coastal-sunset-thumb.webp" },
  { id: "meadows", name: "Green meadows", description: "Rolling hills & open skies", src: "./wallpapers/green-meadows.webp", thumbnail: "./wallpapers/green-meadows-thumb.webp" },
  { id: "waterfall", name: "Woodland waterfall", description: "Flowing water & green woodland", src: "./wallpapers/woodland-waterfall.webp", thumbnail: "./wallpapers/woodland-waterfall-thumb.webp" },
  { id: "dunes", name: "Desert dawn", description: "Golden dunes & a quiet horizon", src: "./wallpapers/desert-dawn.webp", thumbnail: "./wallpapers/desert-dawn-thumb.webp" },
] as const;

export const defaultAppearance: AppearanceSettings = { palette: "blue", wallpaper: "none", visibility: 40, blur: 2, favourites: [], position: "center", paused: false };
const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(max, Math.max(min, value))) : fallback;

// Older backups gain safe defaults; arbitrary image URLs are never accepted.
export function normalizeAppearance(input: unknown): AppearanceSettings {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return {
    palette: appearancePalettes.some(p => p.id === value.palette) ? value.palette as AppearanceSettings["palette"] : "blue",
    wallpaper: value.wallpaper === "daily" || value.wallpaper === "none" || landscapeWallpapers.some(w => w.id === value.wallpaper)
      ? value.wallpaper as AppearanceSettings["wallpaper"] : "none",
    visibility: bounded(value.visibility, defaultAppearance.visibility, 10, 55),
    blur: bounded(value.blur, defaultAppearance.blur, 0, 12),
    favourites: landscapeWallpapers.filter(w => Array.isArray(value.favourites) && value.favourites.includes(w.id)).map(w => w.id),
    position: value.position === "left" || value.position === "right" ? value.position : "center",
    paused: value.paused === true,
  };
}

export function selectedLandscape(selection: AppearanceSettings["wallpaper"], day = dateKey(), favourites: AppearanceSettings["favourites"] = []) {
  if (selection === "none") return undefined;
  if (selection !== "daily") return landscapeWallpapers.find(w => w.id === selection);
  const [year, month, date] = day.split("-").map(Number);
  const ordinal = Math.floor(Date.UTC(year, month - 1, date) / 86400000);
  const selected = landscapeWallpapers.filter(w => favourites.includes(w.id));
  const pool = selected.length ? selected : landscapeWallpapers;
  return pool[((ordinal % pool.length) + pool.length) % pool.length];
}

// Preparation edits have their own Save button; appearance saves immediately.
export function preparationSettingsKey(settings: Settings) {
  const { theme: _theme, appearance: _appearance, ...preparation } = settings;
  return JSON.stringify(preparation);
}
