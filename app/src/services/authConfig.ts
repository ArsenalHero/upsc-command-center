export interface AuthConfig {
  url: string;
  publishableKey: string;
}

// Only a public browser key is accepted. Server keys must never reach a build.
export function parseAuthConfig(value: unknown): AuthConfig | null {
  if (!value || typeof value !== "object") return null;
  const { url, publishableKey } = value as Record<string, unknown>;
  if (!url && !publishableKey) return null;
  if (typeof url !== "string" || typeof publishableKey !== "string")
    throw new Error("Account configuration is incomplete.");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Account service URL is invalid.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")
  )
    throw new Error("Account service URL must be an HTTPS origin.");
  const key = publishableKey.trim();
  let isPublic = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!isPublic && key.split(".").length === 3) {
    try {
      const body = key.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
      isPublic = JSON.parse(atob(body)).role === "anon";
    } catch {
      /* Invalid JWTs are rejected below. */
    }
  }
  if (!isPublic)
    throw new Error(
      "Accounts require a publishable browser key. Private server keys are not allowed.",
    );
  return { url: parsed.origin, publishableKey: key };
}

export interface AuthCallback {
  type: "email" | "recovery" | null;
  tokenHash: string | null;
  error: string;
}
export function readAuthCallback(href: string): AuthCallback {
  const url = new URL(href),
    query = url.searchParams;
  const hash = new URLSearchParams(url.hash.slice(1));
  const type = query.get("type") || query.get("auth") || hash.get("type");
  return {
    type:
      type === "recovery"
        ? "recovery"
        : type === "email" || type === "confirm"
          ? "email"
          : null,
    tokenHash: query.get("token_hash"),
    error:
      query.get("error_description") || hash.get("error_description") || "",
  };
}
export function authRedirect(type: "email" | "recovery", href: string): string {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("auth", type === "email" ? "confirm" : "recovery");
  return url.href;
}
