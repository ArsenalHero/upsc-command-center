import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAuthConfig, type AuthConfig } from "./authConfig";

let initialization:
  | Promise<{ client: SupabaseClient | null; config: AuthConfig | null }>
  | undefined;
export function loadAuthClient() {
  return (initialization ??= (async () => {
    const configured = parseAuthConfig({
      url: import.meta.env.VITE_SUPABASE_URL || "",
      publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    });
    let config = configured;
    if (!config) {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 8000);
      try {
        const response = await fetch(
          new URL("auth-config.json", document.baseURI),
          { cache: "no-store", signal: abort.signal },
        );
        if (!response.ok)
          throw new Error(
            "Account configuration could not be loaded. Please try again.",
          );
        config = parseAuthConfig(await response.json());
      } finally {
        clearTimeout(timer);
      }
    }
    if (!config) return { client: null, config: null };
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit",
        storageKey: "upsc-auth-session",
      },
    });
    return { client, config };
  })());
}
