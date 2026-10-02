import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { loadAuthClient } from "../services/supabase";
import { readAuthCallback, type AuthConfig } from "../services/authConfig";
import { STORAGE_KEY } from "../services/repository";

const MODE_KEY = "upsc-workspace-mode";
interface AuthState {
  client: SupabaseClient | null;
  config: AuthConfig | null;
  user: User | null;
  loading: boolean;
  recovery: boolean;
  guest: boolean;
  error: string;
  enterGuest(): void;
  leaveGuest(): void;
  finishRecovery(): void;
  signOut(): Promise<void>;
}
const Context = createContext<AuthState | null>(null);
function rememberMode(mode: string) {
  try {
    sessionStorage.setItem(MODE_KEY, mode);
  } catch {
    /* In-memory mode still works. */
  }
}
function initialGuest() {
  try {
    const mode = sessionStorage.getItem(MODE_KEY);
    return (
      mode === "guest" ||
      (mode === null && localStorage.getItem(STORAGE_KEY) !== null)
    );
  } catch {
    return false;
  }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true),
    [guest, setGuest] = useState(initialGuest);
  const [recovery, setRecovery] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      booting = true,
      generation = 0;
    let unsubscribe = () => {};
    const callback = readAuthCallback(window.location.href);
    const cleanCallback = () => {
      if (!callback.type && !callback.tokenHash && !callback.error) return;
      const url = new URL(window.location.href);
      for (const key of [
        "auth",
        "type",
        "token_hash",
        "code",
        "error",
        "error_code",
        "error_description",
      ])
        url.searchParams.delete(key);
      if (!url.hash.startsWith("#/")) url.hash = "/";
      window.history.replaceState(null, "", url.href);
    };
    (async () => {
      try {
        const connection = await loadAuthClient();
        if (!active) return;
        const auth = connection.client;
        setClient(auth);
        setConfig(connection.config);
        if (!auth) {
          if (callback.type)
            setError(
              "Accounts are being set up. Please try this link again later.",
            );
          return;
        }
        const {
          data: { subscription },
        } = auth.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          if (event === "PASSWORD_RECOVERY") setRecovery(true);
          if (booting || event === "INITIAL_SESSION") return;
          const token = ++generation;
          if (event === "SIGNED_OUT" || !session) {
            setUser(null);
            setRecovery(false);
            setLoading(false);
            return;
          }
          // Do not await another Auth method inside this callback (the SDK holds a lock).
          setTimeout(() => {
            if (!active || token !== generation) return;
            auth.auth
              .getUser()
              .then(({ data, error: authError }) => {
                if (!active || token !== generation) return;
                setUser(authError ? null : data.user);
                if (authError)
                  setError(
                    "Your session could not be verified. Log in again to open your records.",
                  );
                else {
                  setGuest(false);
                  rememberMode("account");
                  setError("");
                }
                setLoading(false);
              })
              .catch(() => {
                if (active && token === generation) {
                  setUser(null);
                  setLoading(false);
                  setError(
                    "Your session could not be verified. Please try again.",
                  );
                }
              });
          }, 0);
        });
        unsubscribe = () => subscription.unsubscribe();
        if (callback.error)
          throw new Error(
            "This account link is invalid or expired. Request a new one.",
          );
        if (callback.tokenHash) {
          if (!callback.type)
            throw new Error(
              "This account link is incomplete. Request a new one.",
            );
          const { error: verifyError } = await auth.auth.verifyOtp({
            token_hash: callback.tokenHash,
            type: callback.type,
          });
          if (verifyError)
            throw new Error(
              "This account link is invalid or expired. Request a new one.",
            );
        }
        const {
          data: { session },
          error: sessionError,
        } = await auth.auth.getSession();
        if (sessionError) throw sessionError;
        if (session) {
          const { data, error: userError } = await auth.auth.getUser();
          if (userError)
            throw new Error(
              "Your session could not be verified. Log in again to open your records.",
            );
          if (active) {
            setUser(data.user);
            setGuest(false);
            rememberMode("account");
            if (callback.type === "recovery") setRecovery(true);
          }
        } else if (callback.type === "recovery") {
          throw new Error(
            "This reset link is invalid or expired. Request a new password reset email.",
          );
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        booting = false;
        if (active) {
          cleanCallback();
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      generation++;
      unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        client,
        config,
        user,
        loading,
        recovery,
        guest,
        error,
        enterGuest() {
          rememberMode("guest");
          setGuest(true);
        },
        leaveGuest() {
          rememberMode("account");
          setGuest(false);
        },
        finishRecovery() {
          setRecovery(false);
        },
        async signOut() {
          if (client) {
            const { error: signOutError } = await client.auth.signOut({
              scope: "local",
            });
            if (signOutError) throw signOutError;
          }
          setUser(null);
          setGuest(false);
          setRecovery(false);
          rememberMode("account");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is missing.");
  return value;
}
