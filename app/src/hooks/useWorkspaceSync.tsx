import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "./useAuth";
import { DataProvider } from "./useData";
import {
  CloudWorkspaceRepository,
  type SyncStatus,
} from "../services/cloudRepository";
import { createWorkspaceTransport } from "../services/workspaceTransport";

interface WorkspaceSync {
  cloud: boolean;
  status: SyncStatus;
  retry(): Promise<boolean>;
  refresh(discard?: boolean): void;
  signOut(discard?: boolean): Promise<void>;
}
const guestStatus: SyncStatus = {
  state: "synced",
  message: "Saved on this device",
  updatedAt: "",
};
const Context = createContext<WorkspaceSync | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.user)
    return (
      <Context.Provider
        value={{
          cloud: false,
          status: guestStatus,
          retry: async () => true,
          refresh: () => {},
          signOut: async () => auth.leaveGuest(),
        }}
      >
        <DataProvider>{children}</DataProvider>
      </Context.Provider>
    );
  return <AccountWorkspace key={auth.user.id}>{children}</AccountWorkspace>;
}
function AccountWorkspace({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [repository, setRepository] = useState<CloudWorkspaceRepository | null>(
    null,
  );
  const [error, setError] = useState(""),
    [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!auth.user || !auth.client || !auth.config) return;
    let active = true,
      opened: CloudWorkspaceRepository | undefined;
    const transport = createWorkspaceTransport(
      auth.client,
      auth.config,
      auth.user.id,
    );
    setRepository(null);
    setError("");
    CloudWorkspaceRepository.open(auth.user.id, transport)
      .then((repo) => {
        if (!active) {
          repo.dispose();
          return;
        }
        opened = repo;
        setRepository(repo);
        void repo.flush();
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
      opened?.dispose();
      transport.dispose?.();
    };
  }, [auth.user?.id, auth.client, auth.config, epoch]);
  if (repository)
    return (
      <CloudProvider
        repository={repository}
        refresh={() => setEpoch((e) => e + 1)}
      >
        {children}
      </CloudProvider>
    );
  if (error)
    return (
      <main className="workspace-load-error">
        <span className="auth-form-icon">!</span>
        <h1>Your workspace couldn't be opened.</h1>
        <p>{error}</p>
        <p>Your records haven't been replaced. Reconnect and try again.</p>
        <div className="button-group">
          <button
            className="btn primary"
            onClick={() => setEpoch((e) => e + 1)}
          >
            Try again
          </button>
          <button
            className="btn secondary"
            onClick={async () => {
              try {
                await auth.signOut();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Back to log in
          </button>
        </div>
      </main>
    );
  return (
    <div className="page-loading" role="status">
      Opening your private preparation workspace…
    </div>
  );
}
function CloudProvider({
  repository,
  refresh,
  children,
}: {
  repository: CloudWorkspaceRepository;
  refresh(): void;
  children: ReactNode;
}) {
  const auth = useAuth();
  const status = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
  );
  useEffect(() => {
    const online = () => {
      void repository.flush();
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (repository.hasPendingChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [repository]);
  return (
    <Context.Provider
      value={{
        cloud: true,
        status,
        retry: () => repository.flush(),
        refresh(discard = false) {
          if (repository.hasPendingChanges() && !discard)
            throw new Error("Sync your pending changes before refreshing.");
          if (discard) repository.discardCache();
          refresh();
        },
        async signOut(discard = false) {
          if (!discard && !(await repository.flush()))
            throw new Error(
              "Your changes haven't synced. Retry syncing or export a backup before signing out.",
            );
          await auth.signOut();
          repository.discardCache();
          repository.dispose();
        },
      }}
    >
      <DataProvider key={repository.ownerId} repository={repository}>
        {children}
      </DataProvider>
    </Context.Provider>
  );
}
export function useWorkspaceSync() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider is missing.");
  return value;
}
