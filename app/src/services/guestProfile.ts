export const GUEST_PROFILE_KEY = "upsc-guest-profile:v1";
const QUOTE_KEY = "upsc-guest-quote:v1";
type GuestStorage = Pick<Storage, "getItem" | "setItem">;

function browserStores(): GuestStorage[] {
  const stores: GuestStorage[] = [];
  if (typeof window === "undefined") return stores;
  for (const key of ["localStorage", "sessionStorage"] as const) {
    try { stores.push(window[key]); } catch { /* Try the next storage option. */ }
  }
  return stores;
}

export function normalizeGuestName(value: string) {
  return Array.from(value.normalize("NFC").replace(/\s+/gu, " ").replace(/[\u0000-\u001f\u007f]/g, "").trim()).slice(0, 60).join("");
}

function readProfiles(stores: GuestStorage[]) {
  return stores.flatMap(storage => {
    try {
      const profile = JSON.parse(storage.getItem(GUEST_PROFILE_KEY) || "null");
      if (typeof profile?.name !== "string") return [];
      const name = normalizeGuestName(profile.name);
      const updatedAt = Number.isSafeInteger(profile.updatedAt) && profile.updatedAt >= 0 ? profile.updatedAt : 0;
      return name ? [{ name, updatedAt }] : [];
    } catch { return []; }
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadGuestName(stores = browserStores()) {
  return readProfiles(stores)[0]?.name || "";
}

export function persistGuestName(value: string, stores = browserStores()) {
  const name = normalizeGuestName(value);
  if (!name) return false;
  // A session-storage fallback can be newer than an older, now-full local store.
  const updatedAt = Math.max(Date.now(), (readProfiles(stores)[0]?.updatedAt || 0) + 1);
  for (const storage of stores) {
    try { storage.setItem(GUEST_PROFILE_KEY, JSON.stringify({ name, updatedAt })); return true; }
    catch { /* In-memory guest mode remains available. */ }
  }
  return false;
}

// Original study encouragements; these are not attributed to public figures.
export const guestQuotes = [
  "Progress starts with the page you read today.",
  "You do not need a perfect day to take a meaningful step.",
  "A little clarity today makes tomorrow's challenge smaller.",
  "Build understanding one question, one revision, one day at a time.",
  "Let today's effort be something your future self can build on.",
  "A steady routine turns a distant goal into daily progress.",
  "Every mistake you understand becomes a stronger next attempt.",
  "Give the next small step your full attention.",
  "Revision is a promise to remember what you worked hard to learn.",
  "Return to the work with curiosity. There is always more to understand.",
];

export function nextGuestQuote(stores = browserStores()) {
  let index = 0;
  for (const storage of stores) {
    try {
      const raw = storage.getItem(QUOTE_KEY);
      if (raw === null) continue;
      const saved = Number(raw);
      if (Number.isInteger(saved) && saved >= 0 && saved < guestQuotes.length) { index = saved; break; }
    } catch { /* Start with the first quote if storage cannot be read. */ }
  }
  for (const storage of stores) {
    try { storage.setItem(QUOTE_KEY, String((index + 1) % guestQuotes.length)); break; }
    catch { /* Quotes still work without browser storage. */ }
  }
  return guestQuotes[index];
}

export function guestGreeting(now = new Date()) {
  const hour = now.getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
