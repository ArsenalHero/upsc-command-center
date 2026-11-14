const storageKey = "upsc-mock-guest-token";
let memoryToken = "";

// This bearer secret only authorizes mock practice. It never creates an Auth
// account, changes workspace mode, or appears in a URL or downloaded report.
export function mockGuestToken() {
  if (memoryToken) return memoryToken;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      const saved = window[name].getItem(storageKey);
      if (saved && /^[0-9a-f]{64}$/.test(saved)) return memoryToken = saved;
    } catch { /* A memory-only session still allows an attempt. */ }
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  memoryToken = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try { window[name].setItem(storageKey, memoryToken); break; } catch { /* Try the next storage option. */ }
  }
  return memoryToken;
}

export const mockOwnerKey = (userId?: string) => userId || `guest:${mockGuestToken().slice(0, 16)}`;
export const mockSessionParams = (userId?: string) => userId ? {} : { guestToken: mockGuestToken() };
