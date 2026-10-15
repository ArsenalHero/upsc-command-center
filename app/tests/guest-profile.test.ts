import test from "node:test";
import assert from "node:assert/strict";
import { GUEST_PROFILE_KEY, guestGreeting, guestQuotes, loadGuestName, nextGuestQuote, normalizeGuestName, persistGuestName } from "../src/services/guestProfile";

function memory() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
const blocked = { getItem(): string | null { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); } };

test("guest names preserve Unicode, normalize whitespace and stay separate from study records", () => {
  const store = memory(); store.setItem("upsc-command-center:v1", "existing study records");
  assert.equal(normalizeGuestName("  आर्या   Rao\n "), "आर्या Rao");
  assert.equal(normalizeGuestName("Jose\u0301"), "José");
  assert.equal(Array.from(normalizeGuestName("🙂".repeat(80))).length, 60);
  assert.equal(persistGuestName("  Asha   Rao ", [store]), true);
  assert.equal(loadGuestName([store]), "Asha Rao");
  assert.equal(JSON.parse(store.getItem(GUEST_PROFILE_KEY)!).name, "Asha Rao");
  assert.equal(store.getItem("upsc-command-center:v1"), "existing study records");
  assert.equal(persistGuestName("\u0000   ", [store]), false);
  assert.equal(loadGuestName([store]), "Asha Rao");
});

test("unreadable or malformed guest storage falls back without blocking guest access", () => {
  const malformed = memory(), session = memory(); malformed.setItem(GUEST_PROFILE_KEY, "{broken");
  assert.equal(loadGuestName([malformed, blocked]), "");
  assert.equal(persistGuestName("Meera", [blocked, session]), true);
  assert.equal(loadGuestName([malformed, blocked, session]), "Meera");
  assert.equal(persistGuestName("Meera", [blocked]), false);
  assert.equal(loadGuestName([blocked]), "");
});

test("a newly saved name wins over a stale copy when local storage is full", () => {
  const local = memory(), session = memory();
  persistGuestName("Old name", [local]);
  const full = { getItem: local.getItem, setItem() { throw new Error("Quota exceeded"); } };
  assert.equal(persistGuestName("New name", [full, session]), true);
  assert.equal(loadGuestName([full, session]), "New name");
  persistGuestName("Latest name", [local, session]);
  assert.equal(loadGuestName([local, session]), "Latest name");
});

test("quotes advance across visits, wrap safely and use the browser's local greeting time", () => {
  const store = memory();
  const quotes = Array.from({ length: guestQuotes.length }, () => nextGuestQuote([store]));
  assert.deepEqual(quotes, guestQuotes);
  assert.equal(nextGuestQuote([store]), guestQuotes[0]);
  store.setItem("upsc-guest-quote:v1", "Infinity");
  assert.equal(nextGuestQuote([store]), guestQuotes[0]);
  assert.ok(guestQuotes.includes(nextGuestQuote([blocked])));
  assert.equal(guestGreeting(new Date(2026, 9, 15, 9)), "Good morning");
  assert.equal(guestGreeting(new Date(2026, 9, 15, 14)), "Good afternoon");
  assert.equal(guestGreeting(new Date(2026, 9, 15, 19)), "Good evening");
});
